# API Design：共通原則

フレームワークに依存しないAPI設計の共通原則である。
このreferenceは全てのフレームワークの実装に先立って読むこと。

## 原則：契約を明示し、過剰に防御しない

型ヒントやSerializer定義、OpenAPI、`validate()`の戻り値を**契約**として扱う。
契約で保証される値は`[]`や属性アクセスで読む。
`get()`や`default=`は、欠損が仕様として残る場合だけ使う。
返り値は`dict`より**TypedDict**や**dataclass**、Serializerで表現する。

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

### モデルのフィールド定義から型を確定する

DjangoのORMが返す値の型は、モデルのフィールド定義で決まる。
暗黙のデフォルト（AutoFieldなら`int`など）に頼らず、当該モデルの該当フィールドの定義を読み、型注釈を決める。
`values_list()`や`values()`の戻り値も同様である。
ForeignKey先のPK型も、参照先モデルのフィールド定義に従う。

### 契約として使う型には不変条件の検証を入れる

データクラスやTypedDictなどの契約として使う型には、事後条件や不変条件の検証を初期化時に入れると、不正な状態のオブジェクトの流通を防げる。
`@dataclass(frozen=True)`であれば`__post_init__`、TypedDictであれば`validate()`相当の仕組みで実現する。
検証は「この値とあの値が同時にセットされてはいけない」といった、構造上持ちえない状態を排除する。

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
関数名・シグネチャ・docstringの三者で同じ情報を反復しない。

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
