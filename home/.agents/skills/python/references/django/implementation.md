# Django実装reference

このreferenceを読む前に、まず`references/common/api-design.md`を読むこと。
共通原則（**契約**の明示、型設計、docstring）は共通referenceに集約している。

## 実装原則

### 原則：ViewはSerializerの公開APIだけを参照する

Viewから参照してよいのは`validated_data`、`save()`の戻り値、`data`、`instance`、`context`だけである。
`validate()`や`create()`内で設定したカスタム属性をViewから読まない。
保存前は`validated_data`、保存後は`save()`の戻り値を使う。

| 参照したいもの | 使うもの | タイミング |
| --- | --- | --- |
| 検証済みの入力 | `serializer.validated_data` | `is_valid()`の後 |
| 保存後のモデル | `serializer.save()`の戻り値 | `save()`の後 |
| レスポンス用の表現 | `serializer.data` | レスポンス生成時 |
| Viewから渡した追加情報 | `serializer.context` | Serializer内部 |

```text
Request -> View（HTTP、権限、オーケストレーション）
        -> Serializer（入力検証、入出力変換）
        -> Service / Model（ビジネスロジック、永続化）
        -> Response
```

```python
# ❌ ViewがSerializerのカスタム属性へ依存する
class OrderSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        self.calculated_total = compute_total(attrs)
        return attrs


serializer.is_valid(raise_exception=True)
serializer.save()
notify_billing(serializer.calculated_total)
```

```python
class OrderSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs["total"] = compute_total(attrs)
        return attrs

    def create(self, validated_data):
        return Order.objects.create(**validated_data)


serializer.is_valid(raise_exception=True)
total = serializer.validated_data["total"]
order = serializer.save(created_by=request.user)
send_confirmation(order)
return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)
```

## 実装フェーズ

### Phase1：仕様確認

エンドポイントとHTTP method、path、queryパラメータ、bodyパラメータを確認する。
レスポンス構造とステータスコード、認証認可要件を確認する。
`required`とoptionalの境界をOpenAPIと一致させる。

### Phase2：モデルとManager設計

必要なフィールドとリレーションを確認する。
CustomManagerやCustomQuerySetが必要か判断する。
詳細は`references/django/orm.md`を参照する。

### Phase3：Serializer設計

共通原則（契約の明示）に従う。
ほぼ全て**ModelSerializer**を基本とする。
OpenAPIとフィールド名、`required`、`enum`、`format`を一致させる。
`required=True`で保証される入力は`validated_data["field"]`で読む。
Viewから追加文脈が必要なら`get_serializer_context()`を使う。
書き込み可能なNested Serializerは`create()`または`update()`の実装要否を確認する。

```python
class UserSerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = User
        fields = ["id", "username", "email", "full_name", "is_active"]
        read_only_fields = ["id"]
```

```python
class UserViewSet(viewsets.ModelViewSet):
    def get_serializer_context(self) -> dict:
        context = super().get_serializer_context()
        context["requested_by"] = self.request.user
        return context
```

### Phase4：PermissionとAuthentication

`permission_classes`をViewSetへ明示する。
アクションごとに異なる権限が必要なら`get_permissions()`を使う。
レート制限やセキュリティ詳細は`references/django/nfr.md`を参照する。

| シナリオ | Throttle |
| --- | --- |
| 未認証 | `AnonRateThrottle` |
| 認証済み | `UserRateThrottle` |
| 特定エンドポイント | `ScopedRateThrottle` |

```python
class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: User) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user
```

### Phase5：ViewとViewSet実装

`queryset`に適切なeager loadingを入れる。
`get_queryset()`でテナントやユーザー絞り込みを行う。
`perform_create()`でリクエスト依存の保存情報を渡す。
複雑なビジネスロジックはServiceやModelへ寄せる。

| 用途 | クラス | ViewSet相当 |
| --- | --- | --- |
| 一覧と作成 | `ListCreateAPIView` | `ModelViewSet` |
| 取得と更新と削除 | `RetrieveUpdateDestroyAPIView` | `ModelViewSet` |
| フルCRUD | - | `ModelViewSet` |

```python
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet:
        return self.queryset.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer) -> None:
        serializer.save(created_by=self.request.user)
```

保存前の入力参照は`validated_data`を使う。
保存結果が必要な処理は`instance = serializer.save(...)`の戻り値を使う。
ViewからSerializerのカスタム属性を読まない。

### Phase6：URLルーティング

Routerと`basename`を明示する。
OpenAPIとURLパターンを一致させる。

```python
router = SimpleRouter()
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [path("", include(router.urls))]
```

### Phase7：テスト

APIテストの最小構成を用意する。
まず`references/common/testing.md`を読む。
詳細なテスト設計は`references/django/testing.md`を参照する。
正常系、未認証、権限なし、不正データを最低限カバーする。

```python
class UserListAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = UserFactory(is_admin=True)
        self.client.force_authenticate(user=self.user)

    def test_list_returns_users_with_valid_auth(self) -> None:
        UserFactory.create_batch(3)
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, 200)
```

### Phase8：パフォーマンス

N+1回避とページネーション、検索、フィルタを確認する。
ORM最適化の詳細は`references/django/orm.md`を参照する。
ログとレート制限、設定は`references/django/nfr.md`を参照する。

### Phase9：レビュー

静的解析とテスト、契約、権限、N+1を確認する。
機密情報の非出力と例外形式、ログ形式は`references/django/nfr.md`を参照する。
SerializerとViewの境界、主題外の差分混入を確認する。
追加した処理にdocstringが必要か確認し、既存規約に合わせる。

## レビュー観点

- 不要な`get()`や`getattr(..., default)`がないか
- ViewとSerializerの責務境界が崩れていないか
- 保存前に`serializer.data`やSerializerのカスタム属性を参照していないか
- `serializer.save()`後に必要な値を戻り値または`instance`から受けているか
- 認証認可テストがあるか
- N+1がないか
- 変更の主題と無関係な差分が混ざっていないか

## トラブルシューティング

### Permission Deniedでテストが失敗する

1. `force_authenticate()`を呼んでいるか
2. `permission_classes`が正しいか
3. ユーザーのroleやgroupが十分か

### POSTで403になる

1. `permission_classes`とテストユーザーの権限を確認する
2. 認証方式とCSRF前提を確認する

## 参考資料

- [DRF公式ドキュメント](https://www.django-rest-framework.org/)
- [drf-spectacular](https://drf-spectacular.readthedocs.io/)
- [OpenAPI3.0仕様](https://swagger.io/specification/)
