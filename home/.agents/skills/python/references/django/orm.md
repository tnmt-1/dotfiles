# Django ORM reference

## 暗黙の知識ベース

- QuerySet chaining
- CustomManagers
- Django ORMとの付き合い方

## Modelに置くものと置かないもの

Modelは永続化の層として扱う。
置くのはフィールド定義、DB制約、再利用する絞り込み条件の名前付けまでにとどめる。
判定や状態遷移、複数モデルへの書き込みはServiceに置く。
層ごとの責務と依存方向は`references/django/implementation.md`の「ビジネスロジックはServiceに置く」を参照する。

### DB制約で整合性を担保する

アプリケーション側だけで整合性を守ろうとせず、`constraints`や`unique`でDB側にも制約を置く。
DBの制約を厳しくするほど、アプリケーションコードの分岐と運用時の確認が減る。
フィールドの`default=`は、可能な限り付けない。デフォルト値はNULL許可と同じく状態の組み合わせを増やすためである。
初期値が必要ならマイグレーションで設定する。

### Manager / QuerySetに置くのは絞り込み条件の名前付けまで

同じ絞り込み条件を複数箇所で使うなら、CustomQuerySetのメソッドとして名前を付ける。
どの条件で絞るかを決める判定はServiceが持ち、QuerySetは条件を表現するだけにする。
1か所でしか使わない絞り込みは、Serviceの中に直接書いてよい。

```python
class OrderQuerySet(models.QuerySet["Order"]):
    def paid_in_month(self, year: int, month: int) -> "OrderQuerySet":
        return self.filter(paid_at__year=year, paid_at__month=month)

    def with_items(self) -> "OrderQuerySet":
        return self.prefetch_related("items")
```

```python
# services/order.py
def cancel_order(order: Order) -> None:
    if order.status not in ("pending", "confirmed"):
        raise OrderCannotBeCancelled(order.id)
    order.status = "cancelled"
    order.save(update_fields=["status"])
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

複数箇所で使う絞り込み条件は**CustomQuerySet**に切り出す。
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
