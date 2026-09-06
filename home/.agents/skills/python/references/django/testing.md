# Django testing reference

このreferenceを読む前に、まず`references/common/testing.md`を読むこと。
共通方針（AAA、factory_boyの基本、命名規則、カバレッジ）は共通referenceに集約している。
このreferenceではDjango固有のテスト手法のみを扱う。

## テストクラス

| 用途 | 基底クラス |
|---|---|
| DBアクセスあり | `django.test.TestCase` |
| DBアクセスなし | `django.test.SimpleTestCase` |
| DRF APIテスト | `rest_framework.test.APITestCase`または`TestCase + APIClient` |

```python
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
```

## factory_boy（Django）

Djangoでは`factory.django.DjangoModelFactory`を基底クラスに使う。

```python
import factory


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user_{n:04d}")
    email = factory.LazyAttribute(lambda u: f"{u.username}@example.com")
```

## DRF APIテスト

`APITestCase`または`TestCase + APIClient`を使う。
`force_authenticate()`で認証状態を明示する。
正常系と未認証、権限なし、不正データを最低限カバーする。

```python
class ArticleAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory()
        self.client.force_authenticate(user=self.user)

    def test_list_returns_200_for_authenticated_user(self):
        ArticleFactory.create_batch(3)
        res = self.client.get("/api/articles/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
```

## Serializerテスト

`is_valid()`の結果と`errors`を明示確認する。
カスタムバリデーションを単独で検証する。
出力表現が契約どおりか確認する。

## N+1クエリ検出

```python
class QueryCountTests(TestCase):
    def test_list_has_no_nplus1(self):
        PoolFactory.create_batch(10)
        with self.assertNumQueries(2):
            res = self.client.get("/api/pools/")
        self.assertEqual(res.status_code, 200)
```

## そのほかのテスト手法

| 対象 | 方法 |
|---|---|
| Management Command | `call_command("command_name", *args)` |
| Signal | `unittest.mock.patch`でハンドラを検証 |
| 外部API呼び出し | `unittest.mock.patch`で境界を切る |
| フォーム | `is_valid()`と`clean_*`を確認 |

## テストデータ管理

`setUpTestData()`はクラス全体で不変なデータだけに使う。
テスト内でクラスレベルのデータを変更しない。

## 実行方法

```text
# djangoのテストランナー
poetry run python src/manage.py test {module}

# pytest (pytest-django)
poetry run pytest {module} -v
```

## よく使う対応表

| シチュエーション | 使うもの |
|---|---|
| DBありのテスト | `django.test.TestCase` |
| DBなしのテスト | `django.test.SimpleTestCase` |
| DRF APIテスト | `APITestCase`または`APIClient` |
| 認証状態の指定 | `force_authenticate()`または`login()` |
| N+1検出 | `assertNumQueries` |
| テストクライアント | `self.client`（`TestCase`内蔵）または`APIClient` |

## 参考資料

- [Django testing docs](https://docs.djangoproject.com/en/stable/topics/testing/)
- [DRF testing docs](https://www.django-rest-framework.org/api-guide/testing/)
- [pytest-django](https://pytest-django.readthedocs.io/)
- [factory_boy docs](https://factoryboy.readthedocs.io/)
