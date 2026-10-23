# API Design：共通原則

フレームワークに依存しないAPI設計の共通原則である。
このreferenceは全てのフレームワークの実装に先立って読むこと。

## 原則：契約を明示し、過剰に防御しない

型ヒントやSerializer定義、OpenAPI、`validate()`の戻り値を**契約**として扱う。
契約で保証される値は`[]`や属性アクセスで読む。
`get()`や`default=`は、欠損が仕様として残る場合だけ使う。
返り値は`dict`より**TypedDict**や**dataclass**、Serializerで表現する。
引数も同様である。特定のキーを前提に読む`dict`引数は、TypedDictにするか、キーごとに個別の引数へ分ける。
`dict`のまま受け取ってよいのは、テンプレートのcontextやJSONとして丸ごと保存する値のように、中身のキーを読まずに渡すだけの場合に限る。
`list[dict]`のように入れ子になった`dict`も同じ扱いにする。要素の形が決まっているなら、要素用のTypedDictを定義して`list[XxxItem]`と書く。
JSONFieldへそのまま保存する値であっても、モデルのコメントやSerializerで形を固定しているなら、その形を型に写す。

```python
class HogeResult(TypedDict):
    a: str


def fuga() -> str:
    return hoge()["a"]


class HogeResultOptional(TypedDict, total=False):
    a: str


def fuga_optional() -> str | None:
    return hoge_optional().get("a")
```

## 型設計の指針

入力のバリデーションはSerializerに任せ、バリデーション済みの値を信頼する。
出力は可能な限り型を明示し、呼び出し元で不要な分岐を減らす。
`total=False`のTypedDictは、フィールドの有無が仕様上変わる場合に限って使う。
TypedDictのキーは、実際に受け取る・返すものに限定する。
RFCや外部APIの仕様書にあるキーの一覧をそのまま写さない。定義にあるキーは読み手に「受け取れる」と伝わるため、来ないキーが混ざると実装と食い違う。
値が存在しないことは空のdictやlistではなく`None`で表し、戻り値の型を`X | None`にする。
アプリケーションコードの引数にはデフォルト値を付けず、呼び出し側で毎回明示する。
デフォルト値を持ってよいのは、汎用ライブラリに相当する層だけである。

### モデルのフィールド定義から型を確定する

DjangoのORMが返す値の型は、モデルのフィールド定義で決まる。
暗黙のデフォルト（AutoFieldなら`int`など）に頼らず、当該モデルの該当フィールドの定義を読み、型注釈を決める。
`values_list()`や`values()`の戻り値も同様である。
ForeignKey先のPK型も、参照先モデルのフィールド定義に従う。

### 契約として使う型には不変条件の検証を入れる

データクラスやTypedDictなどの契約として使う型には、事後条件や不変条件の検証を初期化時に入れると、不正な状態のオブジェクトの流通を防げる。
`@dataclass(frozen=True)`であれば`__post_init__`、TypedDictであれば`validate()`相当の仕組みで実現する。
検証は「この値とあの値が同時にセットされてはいけない」といった、構造上持ちえない状態を排除する。

### 可変性は型の役割で選ぶ

設定、実行条件、保存先の所在、処理の結果を表す型は`@dataclass(frozen=True)`にする。
`frozen=False`にするのは、処理の途中で件数などを積み上げる集計用の型だけにする。
frozenな型にコレクションを持たせるときは、`list`ではなく`tuple`にする。

```python
@dataclass(frozen=True)
class ConsentValidationResult:
    is_valid: bool
    error_term_ids: tuple[str, ...]
```

### 保存する値は、保存形式への変換と状態遷移を自分で持つ

キャッシュやKVS、JSONカラムへ保存する値は`@dataclass(frozen=True)`にし、キーの組み立てと値の変換をそのクラスに置く。
呼び出し側には、キーのプレフィックスや`json.dumps`を書かない。
保存形式を知っている場所が1か所になり、形式を変えるときもそのクラスだけを直せばよい。
状態を変えるメソッドは、`dataclasses.replace`で新しいインスタンスを返す。

```python
@dataclass(frozen=True)
class LoginSession:
    session_id: str
    client_id: str
    is_authenticated: bool

    def authenticate(self) -> "LoginSession":
        return dataclasses.replace(self, is_authenticated=True)

    @classmethod
    def encode_key(cls, session_id: str) -> str:
        return f"{REDIS_KEY_PREFIX_LOGIN_SESSION}:{session_id}"

    def encode_value(self) -> str:
        return json.dumps(dataclasses.asdict(self))

    @classmethod
    def decode_value(cls, v: str) -> "LoginSession":
        return cls(**json.loads(v))
```

キーと値の対応だけを扱い、状態を持たない場合は、classmethodだけのクラスでよい。

### 意味の違う文字列には`TypeAlias`で名前を付ける

同じ`str`でも、受け渡す値の意味が違うなら`TypeAlias`で名前を付ける。
シグネチャを読むだけで、どの文字列を渡すかが分かる。

```python
# SAMLリクエストとSAMLレスポンスを紐づけるID
RelayState: TypeAlias = str
# Base64でエンコードしたXML
SamlResponse: TypeAlias = str


def post_saml_verify(saml_code: str, saml_response: SamlResponse, relay_state: RelayState) -> SamlVerifyResponse:
    ...
```

### 別の層の型は、使うメソッドだけを並べたProtocolで受ける

別の層の具象クラスを受け取るときは、使う属性とメソッドだけを並べたProtocolを定義して、引数の型にする。
具象クラスを型注釈で参照する必要があるときも、importは`TYPE_CHECKING`の中に限り、実行時の依存を作らない。
テストでは`create_autospec`で作ったモックをそのまま渡せる。

```python
if TYPE_CHECKING:
    from accounts.documents import UserDocument


class UserAttributesProvider(Protocol):
    def get_attributes_info(self) -> dict[str, Any]: ...


class UserTenantsProvider(UserAttributesProvider, Protocol):
    def get_user_pool_children_info(self, is_active: bool) -> dict[str, Any]: ...


class TenantRule:
    def get_country_meta(self, user: UserAttributesProvider | None) -> CountryMeta | None: ...

    def has_insufficient_terms(self, require_terms: list[Term], user: "UserDocument") -> bool: ...
```

実データの型が仕様と食い違うなら、TypedDictには実際に入りうる型を書き、判定は専用の関数に任せる。
`bool()`は`"0"`のような文字列も真と判定するため、可否の判定には使わない。

```python
class SamlUserInfo(TypedDict):
    id: str
    # スキーマ上はboolだが、別の型で保存されているデータがある
    is_saml_auth: NotRequired[bool | int | str | None]


def is_enabled_flag(value: bool | int | str | None) -> bool:
    """True、1、"1"だけを有効として扱う"""
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value == 1
    if isinstance(value, str):
        return value == "1"
    return False
```

### 型に結び付く定数は型の中に置く

型の定義に結び付く定数は、`ClassVar`でその型に置く。`ClassVar`にすればdataclassのフィールドにならない。
外部APIの都合で決まる値（タイムアウト、ヘッダー名）は、外部連携アダプタのクラス変数にする。

```python
@dataclass(frozen=True)
class AnswerResources:
    # 回答を削除するときに0にする回答数のカラム
    MYSQL_ANSWER_COUNT_COLUMNS: ClassVar[tuple[str, ...]] = ("ans_cnt", "ans_file_cnt")

    form_id: str
    tenant_id: str


class SamlServiceClient:
    API_KEY_HEADER = "X-Internal-Api-Key"
    # 内部通信なので短くする
    REQUEST_TIMEOUT = 3
```

## 標準ライブラリの選び方

パス操作は`os.path`ではなく`pathlib.Path`を使う。
既存コードの`os.path`に触れるときは、同じモジュール内で`pathlib`にそろえる。
関数の入出力が変わらない内部実装であっても、同じモジュールに両方が混在すると読み手が使い分けの理由を探すことになる。

## docstring規約

新規の関数やメソッド、クラスで意図や入出力、例外が自明でないものにはdocstringを書く。
既存プロジェクトに書式がある場合はそれに合わせる。
規約が明確でない場合はGoogle styleを基本とし、日本語で書く。
見出しや単文末には`。`を付けない。
今回の変更と無関係なdocstringは不用意に触らない。

**型ヒントがある場合、docstring側に型を書かない。**
シグネチャの型ヒントを契約とし、docstringは意味・制約・例外など型だけでは伝わらない情報に集中する。
`Args`や`Returns`では型名や`(str)`のような型表記を省略し、説明文だけを書く。

```python
def create_user(email: str, username: str) -> User:
    """ユーザー登録処理を実行する

    Args:
        email: メールアドレス
        username: ユーザー名

    Returns:
        作成されたユーザーインスタンス

    Raises:
        ValidationError: 入力値が不正な場合
    """
```

関数名・変数名・型ヒントだけで役割が十分に伝わる場合、docstringは不要か、1行の要約で済ませてよい。
「追記専用で更新しない」のようにクラス全体にかかる制約は、メソッドではなくクラスのdocstringに書く。
関数名・シグネチャ・docstringの三者で同じ情報を反復しない。

## コメント規約

コードを読めば分かること、静的解析やlinterが検出することはコメントに書かない。
例えば「`list`メソッドが組み込み`list`を隠すため`from __future__ import annotations`を使う」は、外すと即座にエラーになるため書かない。
コメントに残すのは、コードからは読み取れない理由や制約に限る。

## 命名の一貫性

メソッド名は「何を」「どうやって」取得するかを一貫した語彙で表す。
引数による絞り込みには`by`を使うなど、同じ意味の関係には同じ前置詞や動詞を割り当てる。
語尾の複数形が二重にならないようにする（`terms_ids`ではなく`term_ids`など）。
公開APIになる名前ほど、タイポや揺れに注意する。

## リクエスト設計とレスポンス設計

エンドポイントとHTTP method、path、queryパラメータ、bodyパラメータをOpenAPIと一致させる。
レスポンス構造とステータスコード、認証認可要件を事前に確認する。
`required`とoptionalの境界を明確にする。
エラーレスポンスは統一された形式で返す。
