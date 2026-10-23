# 手本: 国・地域ルールの切り出し（Djangoサービス層）

題材は、規約への同意を「ユーザーの国」と「テナントの設定」で制限する機能である。
2つのモジュールの自由関数群と、シリアライザに漏れていた計算を、3つのクラスに整理した。

## 前の状態

`country_codes.py`（3関数）と`country_rules.py`（約15関数）があり、すべて自由関数だった。

```python
def resolve_user_country_code_id(user_pool, attributes, user=None) -> str | None
def is_japan_equivalent_term(term_country_code_ids, japan_country_code_id) -> bool
def get_country_meta(user_pool_child_id, user=None) -> CountryMeta | None
def resolve_country_info(user_pool, attributes, user=None) -> CountryInfo | None
def add_country_info_to_terms(terms, user_pool_child_id, user_pool, attributes, user=None)
def filter_terms_for_response(terms, user_pool)
def filter_terms_for_consent_check(terms, user_pool, user_pool_child_id, attributes, user=None)
def _evaluate_japan_equivalent_consent(terms, requested_terms, user_pool)
def _evaluate_country_consent(terms, requested_terms, user_pool, attributes, user=None)
def evaluate_terms_country_consent(terms, requested_terms, user_pool, user_pool_child_id, attributes, user=None)
def evaluate_country_attribute_assignment_enable(user_pool, user_pool_child_id)
def evaluate_term_usage_enable(term, user_pool_child_id)
def evaluate_term_auto_append_to_child_enable(term)
def evaluate_country_removal_from_in_use_term(term, final_has_country)
```

`is_country_attribute_assigned(user_pool_child_id)`は`models/user_pool_child_attribute_settings.py`に置かれていた。
呼び出し元は上の関数群だけだった。

シリアライザの`_validate_terms_user_pool_child`には、30行ほどの計算が直書きされていた。
テナントの規約ID集合を2つのクエリから合成してリクエストとの差集合でエラーを投げ、同じ集合でもう一度規約を取得する。

## 見つかった兆候

- `user_pool`がほぼ全関数の引数にある。`user_pool.country_terms_enabled`と
  `user_pool.japan_country_code_id`しか使っていない関数も多い。
- `user_pool_child_id`を受け取る関数は、毎回`is_country_attribute_assigned(user_pool_child_id)`を呼ぶか、
  `UserPoolChildren.objects.filter(id=...).select_related('user_pool').get()`でfetchしてから始まる。
- `if not user_pool.country_terms_enabled: return <既定値>`が8つの関数の1行目にある。
- 同意検証の3関数が、`terms, requested_terms, user_pool, attributes, user`をそのまま下へ渡している。
  呼び出しの順は`evaluate_terms_country_consent` → `_evaluate_country_consent` → `_evaluate_japan_equivalent_consent`である。
- 元モジュールに`# ─── 該当規約フィルタ ───` `# ─── 同意検証 ───` `# ─── 管理画面事前条件 ───`の見出しがある。
- シリアライザの中に「集合の合成 → 差集合 → エラー → 再クエリ」の流れがある。

## 引いた境界

### `OrganizationRule(user_pool)` — 組織レベルの判定

保持するのは`user_pool`だけである。`japan_country_code_id`と`country_terms_enabled`はpropertyにした。
組織の設定だけで決まる、次の判断をここに置く。

- `is_japan_equivalent_term(term)`
- `resolve_user_country_code_id(attributes, user)`
- `resolve_country_info(attributes, user)`
- `filter_terms(terms)`
- `evaluate_term_auto_append_to_child_enable(term)`
- `evaluate_country_removal_from_in_use_term(term, final_has_country)`

理由：これらは`user_pool`以外に「誰の」情報も要らない。テナントを知らなくてよい判断を、
テナントを知っているクラスに置くと、後から読む人が「テナントの状態に依存するのか」を毎回確かめることになる。

### `TenantRule(user_pool_child)` — テナントレベルの判定

`user_pool_child`と、そこから作った`org_rule = OrganizationRule(user_pool_child.user_pool)`を保持する。
`from_user_pool_child_id(id)`ファクトリと`is_country_attribute_assigned_by_id(id)`クラスメソッドを持ち、
IDしか持たない呼び出し側にも対応する。
ここに置く判断は次のとおりである。

- `get_country_meta(user)`
- `add_country_info_to_terms(terms, attributes, user)`
- `filter_terms_for_consent_check(terms, attributes, user)`
- `has_insufficient_terms(require_terms, user)`
- `get_terms()`
- `evaluate_country_attribute_assignment_enable()`
- `evaluate_term_usage_enable(term)`

理由：これらはテナントへの属性割当状態を見て初めて決まる。組織の設定も要るので、
テナントが組織を保持する向きで合成した。組織がテナントを知る向きにすると、
組織レベルの判断に「どのテナントか」という余計な文脈が混ざる。

models側にあった`is_country_attribute_assigned`はここに移した。
モデルの都合ではなく「テナントが国ルールの対象か」という判断だったからである。

### `ConsentEvaluation(terms, requested_terms, user_pool, user_pool_child_id, attributes, user)` — 1回の同意評価

入力をコンストラクタで受け、`org_rule`と`tenant_rule`を組み立てる。
公開メソッドは`evaluate_terms_country()`の1つだけである。`_evaluate_japan_equivalent()`と`_evaluate_country()`は引数なしのステップになった。

理由：3つの関数が同じ5〜6個の入力を持ち回していた。ここから「同意検証1回分」という単位があると分かる。
持ち回っていた引数がselfに載ったので、ステップの引数は0になった。

### `ConsentEvaluationPreparation(user_pool_child_term_ids, request_term_ids)` — 不変の値オブジェクト

シリアライザに直書きされていた計算を、次のように移した。

- 集合の合成：`get_user_pool_child_term_ids(user_pool_child)`クラスメソッド
- 差集合：`error_term_ids` property
- 再クエリ：`get_required_terms()`

シリアライザに残ったのは「`p.error_term_ids`が空でなければ`ValidationError`を投げる」だけである。

理由：HTTP層にあるべきなのは入力の取り出しとエラーの投げ方だけで、集合演算はドメインの計算である。
計算結果を持たせて導出値をpropertyにすると、HTTPを経由しないテストが書ける。

### 自由関数のまま残したもの

`get_term_country_code_ids(term)`は自由関数のまま残した。引数1つの純粋な変換で、3クラスすべてから使われる部品である。

## 引数の変化（抜粋）

| 関数 | 前 | 後 |
| --- | --- | --- |
| resolve_country_info | user_pool, attributes, user | attributes, user |
| filter_terms_for_response | terms, user_pool | terms |
| filter_terms_for_consent_check | terms, user_pool, user_pool_child_id, attributes, user | terms, attributes, user |
| _evaluate_country_consent | terms, requested_terms, user_pool, attributes, user | （なし） |
| evaluate_country_attribute_assignment_enable | user_pool, user_pool_child_id | （なし） |
| evaluate_term_usage_enable | term, user_pool_child_id | term |

## 旧APIの扱い

元の関数はすべて残し、`# 互換用`を付けて1行の委譲にした。

```python
# 互換用
def get_country_meta(user_pool_child_id, user=None):
    return TenantRule.from_user_pool_child_id(user_pool_child_id).get_country_meta(user)
```

`country_codes.py`は`country_rules.py`に吸収し、唯一の外部import元を書き換えた。
既存テストは無変更で通り、新クラスのテストを追加した。

## 残した迷い

`filter_terms_for_consent_check`には、「ConsentEvaluationに統合できるかもしれない」とコメントを残した。
`ConsentEvaluationPreparation`には、「ConsentEvaluationと統合してもよい」と残した。
どちらも呼び出し側の移行が終わってから判断する。

## この手本の次のコミットが示すこと

切り出しの直後、`OrganizationRule`に新しい判断（複数テナント横断の再同意フィルター）が1メソッド追加された。
新しい判断が「組織の情報とユーザーの所属テナント一覧で決まる」ものだったので、置き場所で迷わなかった。
切り出しの価値は、次の変更を置く場所が決まっていることにある。
