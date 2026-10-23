# Django実装reference

このreferenceを読む前に、まず`references/common/api-design.md`を読むこと。
共通原則（**契約**の明示、型設計、docstring）は共通referenceに集約している。

## 実装原則

### 原則：ビジネスロジックはServiceに置く

判定、状態遷移、複数モデルの読み書き、外部サービスへ渡す値の決定は、すべてServiceに置く。
ModelとSerializer、Viewにはビジネスロジックを書かず、Serviceを呼び出す側に回す。
Serviceに集約しておけば、HTTPの入口やDBの構造を読まなくても業務の流れを追えるうえ、後からの改修も1か所で済む。

| 層 | 置くもの | 置かないもの |
| --- | --- | --- |
| View | HTTPの入出力、権限、Serviceの呼び出し順 | 判定や状態遷移 |
| Serializer | 入力の検証、レスポンス用の整形 | 「〜とみなす」といった業務上の判定 |
| Service | ビジネスロジック、業務単位の型（TypedDictやdataclass） | HTTPの都合、外部APIのキー構造 |
| Model | フィールド定義、DB制約、再利用する絞り込み条件の名前付け | 業務上の判定、複数モデルへの書き込み |
| 外部連携アダプタ | 外部APIの呼び出し、外部APIが要求するキー構造の組み立て | 渡す値の決定 |

依存は View / Serializer → Service → Model / 外部連携アダプタ の一方通行にする。

```mermaid
flowchart TD
    View["View<br/>HTTP入出力・権限・呼び出し順"]
    Serializer["Serializer<br/>入力検証・レスポンス整形"]
    Service["Service<br/>ビジネスロジック・業務単位の型"]
    Model["Model<br/>フィールド定義・DB制約・絞り込み条件"]
    Adapter["外部連携アダプタ<br/>外部API呼び出し・キー構造の組み立て"]
    External[("外部サービス")]
    DB[("DB")]

    View --> Serializer
    View --> Service
    Serializer --> Service
    Service --> Model
    Service --> Adapter
    Model --> DB
    Adapter --> External
    Model -. "禁止" .-> Service
    Adapter -. "禁止" .-> Service
```

ModelからServiceをimportしたくなったら、そのロジックの置き場がModel側に寄りすぎているので、Serviceへ戻す。

引数をほぼそのまま`objects.create()`へ渡すだけのclassmethodをModelに作らない。
切り出す利点がなく、Modelに書き込み操作を集約する方針でもないため、呼び出し側のServiceで直接`create()`する。
「追記専用で更新しない」といった制約は、メソッドで表現するのではなくModelクラスのdocstringに書く。

既存コードは即時に移動せず、新規追加分から原則を適用する。
既存の構成でModel側に関数群がまとまっている場合（ログ作成関数など）は、その構成に合わせてよい。

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

### 原則：Serviceモジュールは業務の単位で切る

ViewやSerializerはURLやリソースごとにモジュールを分けるが、Serviceはその構造に合わせて1:1で分ける必要がない。
Serviceが表すのは業務ロジックであり、HTTPの入口とは別の単位で読まれるからである。
関連する業務を扱う小さなモジュールが複数あるなら、1つにまとめる。
逆に、1つのモジュールが複数の業務を抱えて肥大化したら、業務の境界で分ける。

### 原則：外部連携アダプタはServiceと分ける

外部サービスのAPIを呼ぶクライアントクラスは、Serviceとは別のモジュールに置く。
アダプタが担うのは外部APIの呼び出しと、外部APIが要求するキー構造の組み立てである。
どの値を渡すかはServiceが決める。キー構造は外部側の制約であり、値の決定は業務上の判断だからである。
アダプタ側でキー構造をTypedDictとして定義し、Serviceはその型の値を組み立てて渡す形にすると境界がはっきりする。

クライアントクラスは、公開メソッドがエンドポイントごとに増えていく。
そこへパラメータの組み立てまでプライベートメソッドで足していくと、クラスが1つの責務に収まらなくなる。
組み立ては専用のクラス（`_XxxParamsBuilder`など）に切り出し、クライアントクラスはそのクラスへ委譲する。
状態を持たないなら`classmethod`や`staticmethod`だけのクラスでよく、dataclassにする必要はない。

### 原則：ServiceにRequestを渡さない

ServiceやModelのメソッドへ、DjangoやDRFの`request`をそのまま渡さない。
Viewで必要な値だけを取り出して引数にする。
ミドルウェアがセットする情報のように塊で渡す値は、TypedDictに型を付けて渡す。
`request`を受け取るServiceは、管理コマンドのようにリクエストのない経路から呼べない。

ミドルウェアを通らない経路（テストなど）で値が欠けるなら、引数を`X | None`で受ける。
既存の`request`を受け取るメソッドは残し、TypedDictを受け取る新しいメソッドへ委譲する形で移行する。

```python
class CustomInfo(TypedDict, total=False):
    """CustomRequestLogMiddlewareがrequest.custom_infoにセットする値

    取得に失敗すると空のdictになるため、すべてのキーを任意にする
    """
    ip: str
    ua: str | None
    user_id: str


def create_delete_request(
    form: Form,
    request_user_id: str,
    request_user_email: str,
    custom_info: CustomInfo | None,
) -> DeleteRequest:
    ...
```

```python
# View
create_delete_request(
    form,
    request_user_id=str(request.user.id),
    request_user_email=request.user.email,
    # CustomRequestLogMiddlewareを通らない経路（テストなど）ではセットされない
    custom_info=getattr(request, "custom_info", None),
)
```

### 原則：判定する型は例外を送出せず、応答はエントリポイントで決める

ルールや検証を受け持つ型は、真偽値か結果の値オブジェクトを返すだけにする。
業務上の例外への変換、ログレベル、HTTPステータスは、処理の入口になるクラスや関数（エントリポイント）でまとめて決める。
判定の中で例外を選ぶと、同じ判定を別の場面で使うときに、場面ごとの応答の違いを判定側へ持ち込むことになる。
判定のテストも、戻り値を確かめるだけで済む。
結果の値オブジェクトは`@dataclass(frozen=True)`にし、矛盾する組み合わせを`__post_init__`で弾く。
詳しくは`references/common/api-design.md`の「契約として使う型には不変条件の検証を入れる」を参照する。

```python
class MemberVerification:
    """会員の判定。例外の送出とログの出力は呼び出し側が受け持つ"""

    def __init__(self, user: UserDocument, tenant_id: str):
        self.user = user
        self.tenant_id = tenant_id

    def is_active(self) -> bool:
        return self.user.status == UserStatus.ACTIVE

    def belongs_to_tenant(self) -> bool:
        return self.tenant_id in self.user.active_tenant_ids
```

```python
# エントリポイント
if not verification.is_active():
    exception = UserNotActiveException(client_id=client_id)
    logger.warning("有効な会員ではありません", extra={**log_context, "error_code": exception.code})
    raise exception
```

外部連携アダプタも同じ考え方で書く。
アダプタは失敗を1種類の例外にまとめ、ステータスコード、外部のエラーコード、外部のリクエストIDを載せて送出する。
アダプタ自身のログは`warning`までにとどめる。
`error`にするか、どの業務上の例外に変えるかは、呼び出し側が失敗理由ごとに決める。
ログレベルはプロジェクトの基準に従い、HTTPステータスではなく運用対応が要るかどうかで選ぶ。

```python
try:
    return self.saml_client.post_saml_verify(...)
except SamlApiException as e:
    match e.error_code:
        # 通信失敗（error_code=None）と、こちらの設定の不備は運用対応が要る
        case None | SamlApiErrorCode.UNAUTHORIZED | SamlApiErrorCode.INVALID_REQUEST:
            exception = VerificationRequestFailedException()
            logger.error("検証を依頼できませんでした", extra={**log_extra, "error_code": exception.code})
            raise exception from e
        # 外部から任意に起こせるため、errorにせず件数で監視する
        case SamlApiErrorCode.SIGNATURE_INVALID | SamlApiErrorCode.REPLAYED:
            exception = AssertionUntrustedException()
            logger.warning("アサーションを信頼できません", extra={**log_extra, "error_code": exception.code})
            raise exception from e
        case _:
            exception = AssertionVerificationFailedException()
            logger.warning("アサーションの検証に失敗しました", extra={**log_extra, "error_code": exception.code})
            raise exception from e
```

### 原則：複数の手順を踏む処理は、処理1回分を表すクラスにする

仕様に手順があり、各手順が前の手順の結果を使う処理は、処理1回分を表すクラスにする。
分岐や手順の少ない処理は関数のままでよい。
このクラスが前の原則のエントリポイントにあたり、例外への変換とログは各手順のメソッドの中で行う。

- コンストラクタで入力を受け取り、続けて設定や外部クライアント、接続などの依存を組み立てる。両者の間に`# dependencies`の区切りを置き、依存がどれかを1か所で見分けられるようにする
- 公開メソッドは`exec()`の1つにし、プライベートなメソッドを手順どおりに呼ぶだけにする。仕様のシーケンス図に番号があれば、コメントで対応させる
- 手順の途中で決まる値はselfに代入せず、戻り値と引数で次の手順へ渡す。途中でselfに代入すると、後の手順が呼び出し順に依存し、`assert self.xxx`のような確認が必要になる

```python
class SamlAcs:
    """SAMLのACS。リダイレクト先のURLを返す"""

    def __init__(self, relay_state: RelayState, saml_response: SamlResponse):
        self.relay_state = relay_state
        self.saml_response = saml_response

        # dependencies --------------
        self.settings = SamlSettings.from_env()
        self.saml_client = SamlServiceClient(
            origin=self.settings.api_origin,
            internal_api_key=self.settings.internal_api_key,
        )
        self.redis = CdmRedis(db_number=REDIS_DB_NUM_FOR_SAML)

    def exec(self) -> str:
        # (30) RelayStateからセッションを復元する
        session = self._restore_session()
        # (32) アサーションを検証する
        assertion = self._verify_assertion(session)
        # (42) 会員を検証する
        user_id = self._verify_user(session, assertion)
        # (43) 認可コードを発行する
        return self._issue_redirect_url(session, user_id)
```

### 原則：バッチは「何を、いつまで、どう処理し、状態をどう変えるか」を別の型にする

対象を順に処理し、処理の状態をレコードに記録するバッチは、次の型に分ける。

| 型 | 受け持つこと | 知らないこと |
| --- | --- | --- |
| 管理コマンド | インフラの制約から時間を導く。手順の順番と例外の振り分けを決める | 保存先ごとの処理 |
| 実行条件 | 開始日時、期限、外部I/Oの上限を持つ。期限はpropertyで導く | インフラの制約の数字 |
| 対象の所在 | 保存先を`from_<元>()`で一度だけ解決する。保存先ごとの名前はpropertyにする | 処理の順番 |
| 処理 | 保存先をどの順にどう処理するかを決める。dry run用の件数取得も持つ | 処理の状態 |
| 状態遷移 | 遷移ごとにメソッドを1つ置く。遷移元の状態を条件に行をロックする | 保存先 |

- 処理の型と状態遷移の型は互いを知らない。そのためdry runは処理の型の件数取得だけを呼び、状態を変えずに済む
- 所在の決め方が1か所にあるので、件数の取得と削除が同じ解決結果を使う
- インフラの制約（タスクのタイムアウトなど）は管理コマンドのクラス変数だけに置き、導き方の理由をコメントに残す。処理の型には、導いた値だけを実行条件として渡す

```python
class Command(BaseCommand):
    # Cloud Run Jobのタスクタイムアウト。超えるとバッチは強制終了される
    TASK_TIMEOUT_SECONDS = 10 * 60
    # 着手済みの対象を処理し終える余裕として3分残す
    TIME_LIMIT_SECONDS = TASK_TIMEOUT_SECONDS - 3 * 60
    # 外部の保存先の1回の処理の上限。強制終了で結果を記録できなくなる前に打ち切る
    EXTERNAL_TIMEOUT_SECONDS = 5 * 60

    def handle(self, *args, **options):
        context = DeletionContext(
            started_at=timezone.now(),
            time_limit=datetime.timedelta(seconds=self.TIME_LIMIT_SECONDS),
            external_timeout=datetime.timedelta(seconds=self.EXTERNAL_TIMEOUT_SECONDS),
        )
        ...


@dataclass(frozen=True)
class DeletionContext:
    started_at: datetime.datetime
    time_limit: datetime.timedelta
    external_timeout: datetime.timedelta

    @property
    def deadline(self) -> datetime.datetime:
        return self.started_at + self.time_limit

    def is_time_up(self) -> bool:
        return timezone.now() >= self.deadline
```

状態遷移の型は、遷移元の状態と取得時の値を条件に行をロックし、条件が崩れていたら専用の例外を送出する。
並行して動いた別のバッチとの二重処理は、この例外で検知する。

```python
class DeleteRequestTransition:
    def start(self, delete_request: DeleteRequest) -> None:
        with self._lock(delete_request, from_status=DeleteRequest.Status.RESERVED):
            delete_request.status = DeleteRequest.Status.EXEC
            delete_request.exec_start_date = timezone.now()
            delete_request.save()

    @contextmanager
    def _lock(self, delete_request: DeleteRequest, from_status: int) -> Iterator[None]:
        with transaction.atomic():
            locked = DeleteRequest.objects.select_for_update().filter(
                id=delete_request.id,
                status=from_status,
                retry_count=delete_request.retry_count,
            ).first()
            if locked is None:
                raise DeleteRequestConflictError(delete_request.id)
            yield
```

## フェーズ別のDjango固有事項

進行順序は`SKILL.md`の「実装フロー」に従う。ここには各フェーズでDjango/DRFに固有の判断とコード例だけを書く。

### 仕様確認

`required`とoptionalの境界をOpenAPIと一致させる。

### モデル設計

フィールド定義とDB制約を決める。
再利用する絞り込み条件があればCustomManagerやCustomQuerySetに名前を付ける。
詳細は`references/django/orm.md`を参照する。

### Serializer設計

共通原則（契約の明示）に従う。
ほぼ全て**ModelSerializer**を基本とする。
OpenAPIとフィールド名、`required`、`enum`、`format`を一致させる。
`required=True`で保証される入力は`validated_data["field"]`で読む。
Viewから追加文脈が必要なら`get_serializer_context()`を使う。
書き込み可能なNested Serializerは`create()`または`update()`の実装要否を確認する。

`create()`や`update()`から1か所でしか呼ばない処理は、privateメソッドへ切り出さず、呼び出し元に展開する。
Serializerは入出力の変換とServiceへの受け渡しだけを担うので、切り出すほどの処理があるならServiceへ移す。
2か所以上から呼ぶ場合に限り、privateメソッドにする。

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

### PermissionとAuthentication

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

### ViewとViewSet実装

`queryset`に適切なeager loadingを入れる。
`get_queryset()`でテナントやユーザー絞り込みを行う。
`perform_create()`でリクエスト依存の保存情報を渡す。

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

### URLルーティング

Routerと`basename`を明示する。

```python
router = SimpleRouter()
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [path("", include(router.urls))]
```

### テスト

APIテストの最小構成を用意する。
詳細は`references/django/testing.md`を参照する。

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

### パフォーマンス

ORM最適化の詳細は`references/django/orm.md`を参照する。
ログとレート制限、設定は`references/django/nfr.md`を参照する。

### レビュー

本referenceの「レビュー観点」と`references/django/nfr.md`の「確認チェックリスト」で確認する。

## Adminクラスのdocstring

`ModelAdmin`の説明は、クラス変数やメソッドごとに分散させず、クラスのdocstringに集約する。
表示項目、権限、アクションの見出しで分け、読み手が1か所で全体を把握できるようにする。
アクションの詳細だけは、アクションメソッド側のdocstringに書いてよい。

```python
class FooAdmin(admin.ModelAdmin):
    """Fooの管理画面

    ## 表示項目
    一覧、検索、ソートの対象

    ## 権限
    追加、編集、削除の可否と条件

    ## アクション
    提供するアクションの一覧（詳細は各メソッド）
    """
```

## レビュー観点

- ビジネスロジックがServiceに集約され、ModelやSerializer、Viewに判定が残っていないか
- ModelからServiceをimportしていないか
- 外部連携アダプタに値の決定が入り込んでいないか
- モジュール間で受け渡すdictにTypedDictまたはdataclassが付いているか
- Serviceモジュールの分割が業務の単位になっているか（ViewやSerializerと1:1に分けただけになっていないか）
- 外部APIクライアントのクラスにパラメータ組み立てのプライベートメソッドが増えていないか
- SerializerやViewに、1か所からしか呼ばないprivateメソッドを足していないか
- ServiceやModelのメソッドが`request`を受け取っていないか
- 判定を受け持つ型が、例外の送出やログレベルの決定まで抱えていないか
- 処理1回分のクラスで、手順の途中にselfへ代入していないか
- インフラの制約の数字が、管理コマンド以外に書かれていないか
- パス操作に`os.path`を新たに使っていないか
- 不在を空のdictやlistでなく`None`で返しているか
- 引数にデフォルト値を付けていないか
- 不要な`get()`や`getattr(..., default)`がないか
- ViewとSerializerの責務境界が崩れていないか
- 保存前に`serializer.data`やSerializerのカスタム属性を参照していないか
- `serializer.save()`後に必要な値を戻り値または`instance`から受けているか
- 認証認可テストがあるか
- N+1がないか
- 変更の主題と無関係な差分が混ざっていないか
- 静的解析とテストが通っているか
- 追加した処理にdocstringが必要か確認し、既存規約に合わせているか

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
