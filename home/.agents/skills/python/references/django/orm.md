# Django ORM reference

## 暗黙の知識ベース

- QuerySet chaining
- CustomManagers
- Fat Modelsの段階的適用
- Django ORMとの付き合い方

## Fat Modelsの段階的適用

新規実装ではビジネスロジックをModelやManager、QuerySetへ置く。
既存コードは即時移動せず、新規追加分から原則を適用する。

### 配置の優先順位

- 行レベルの操作はModelメソッド
- テーブル全体のフィルタや集計はCustomManager
- 複数テーブルにまたがる結合や集計はCustomQuerySet
- リクエスト依存や副作用はViewまたはService

```python
class Order(models.Model):
    status = models.CharField(max_length=20)
    items: models.QuerySet[OrderItem]

    def can_cancel(self) -> bool:
        return self.status in ("pending", "confirmed")

    def cancel(self) -> None:
        if not self.can_cancel():
            raise ValidationError("Cannot cancel order")
        self.status = "cancelled"
        self.save(update_fields=["status"])


class OrderQuerySet(models.QuerySet["Order"]):
    def paid_in_month(self, year: int, month: int) -> "OrderQuerySet":
        return self.filter(paid_at__year=year, paid_at__month=month)

    def with_items(self) -> "OrderQuerySet":
        return self.prefetch_related("items")
```

## N+1クエリ防止

ForeignKeyやOneToOneには`select_related()`を使う。
ManyToManyや逆ForeignKeyには`prefetch_related()`を使う。
ループ内で関連を取得しない。

```python
orders = Order.objects.select_related("customer").prefetch_related("items")
for order in orders:
    print(order.customer.name)
    print(list(order.items.all()))
```

```python
orders = Order.objects.prefetch_related(
    Prefetch(
        "items",
        queryset=OrderItem.objects.filter(quantity__gte=2),
        to_attr="bulk_items",
    )
)
```

## QuerySet設計

ビジネスロジックに関わる絞り込みは**CustomQuerySet**に切り出す。
大きいモデルでは`only()`や`defer()`を検討する。
複雑な条件は`Q()`、DB側演算は`F()`を使う。

```python
class OrderQuerySet(models.QuerySet["Order"]):
    def paid(self) -> "OrderQuerySet":
        return self.filter(status="paid")

    def recent(self, days: int = 7) -> "OrderQuerySet":
        return self.filter(paid_at__gte=timezone.now() - timedelta(days=days))

    def by_customer(self, customer) -> "OrderQuerySet":
        return self.filter(customer=customer)
```

```python
results = MyModel.objects.filter(Q(category="a") | Q(category="b"))
Order.objects.filter(total__gte=F("subtotal") + F("tax"))
Article.objects.filter(pk=article.pk).update(views=F("views") + 1)
```

## モデル設計

カスタムUserモデルはプロジェクト開始時に設定する。
マイグレーションは省略しない。
choicesとindex、unique制約、orderingを意図的に設計する。
GenericForeignKeyは極力避ける。

```python
class Article(models.Model):
    class Status(models.IntegerChoices):
        DRAFT = 0, "下書き"
        PUBLISHED = 1, "公開"
        ARCHIVED = 2, "アーカイブ"

    status = models.IntegerField(choices=Status, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    view_count = models.PositiveIntegerField(default=0, db_default=0)

    class Meta:
        unique_together = ["slug", "tenant"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["tenant", "slug"]),
        ]
        ordering = ["-created_at"]
```

## トランザクション管理

関数全体をまとめるなら`@transaction.atomic`を使う。
一部分だけなら`with transaction.atomic()`を使う。
排他が必要なら`select_for_update()`を使う。

```python
@transaction.atomic
def create_order_with_items(order_data, items_data):
    order = Order.objects.create(**order_data)
    for item in items_data:
        OrderItem.objects.create(order=order, **item)
    return order
```

```python
with transaction.atomic():
    account = Account.objects.select_for_update().get(pk=account_id)
    account.balance += amount
    account.save()
```

## バルク操作

ループ内で`save()`を呼ばず、`bulk_create()`や`bulk_update()`を使う。

```python
User.objects.bulk_create([User(**data) for data in users_data], batch_size=1000)
User.objects.bulk_update(users, ["is_active"], batch_size=500)
```

## サブクエリ

```python
latest_order = Order.objects.filter(customer=OuterRef("pk")).order_by("-created_at").values("status")[:1]

customers = Customer.objects.annotate(latest_order_status=Subquery(latest_order))
customers_with_orders = Customer.objects.filter(Exists(Order.objects.filter(customer=OuterRef("pk"))))
```

## パフォーマンスの指針

開発環境でdjango-debug-toolbarを使う。
`exists()`や`count()`、適切なeager loadingを使い、不要な全件読み込みを避ける。
インデックスはフィルタとソートの実パターンに合わせて設計する。

## マイグレーション戦略

`makemigrations`と`migrate`はセットで実行する。
マイグレーションはコミットに含める。
データマイグレーションは**RunPython**で冪等に書く。

## 参考資料

- [Django ORM公式ドキュメント](https://docs.djangoproject.com/en/stable/topics/db/queries/)
- [django-debug-toolbar](https://django-debug-toolbar.readthedocs.io/)
