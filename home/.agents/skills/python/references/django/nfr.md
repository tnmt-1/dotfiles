# Django NFR reference

## 対象領域

- 構造化ログ
- 例外ハンドリング
- セキュリティ
- パフォーマンス
- ページネーション
- レート制限

## ログ

`print()`や`self.stdout.write()`は使わない。
プロジェクト標準のloggerを使う。
`extra={...}`で構造化フィールドを明示する。
`bind()`は局所スコープでのみ使う。
機密情報をログに出さない。

```python
logger.info("メール送信完了", extra={"email_type": "verify", "user_id": user.id})
```

## 例外ハンドリング

業務上意味のあるエラーは独自例外で表現する。
想定した例外だけをキャッチする。
想定外の例外は上位へ委譲する。
どうしても包括キャッチするなら、ログ出力して再送出する。

```python
try:
    user = User.objects.get(id=user_id)
except User.DoesNotExist:
    raise UserNotFoundException()
```

```python
def custom_exception_handler(exc: Exception, context: dict) -> Response:
    logger.warning("例外レスポンス返却", extra={"exception": str(exc), "type": type(exc)})
    if isinstance(exc, ValidationError):
        return exception_handler(exc, context)
    logger.error("An unknown error occurred", exc_info=True)
    return Response({"code": "UNKNOWN_ERROR", "message": "Internal server error"}, 500)
```

## セキュリティ

適切なPermissionクラスを設定する。
秘密情報は環境変数から取得する。
エラーレスポンスに内部情報を含めない。
Django標準の安全機構を外さない。
認証トークンや個人情報をログに出さない。

```python
class CustomPermission(BasePermission):
    def has_permission(self, request, view):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        return True
```

## パフォーマンス

ループ内でクエリを発行しない。
`select_related()`と`prefetch_related()`を関係に応じて使う。
大量データエンドポイントにはページネーションを入れる。
必要なら`assertNumQueries`で検証する。

```python
class QueryCountTests(TestCase):
    def test_list_has_no_nplus1(self):
        PoolFactory.create_batch(10)
        with self.assertNumQueries(2):
            res = self.client.get("/api/pools/")
        self.assertEqual(res.status_code, 200)
```

## 設定観点

`ATOMIC_REQUESTS`は長時間トランザクションに注意する。
`CONN_MAX_AGE`は接続再利用の方針として確認する。
CORSと`SECURE_PROXY_SSL_HEADER`、`CSRF_TRUSTED_ORIGINS`を環境に合わせて確認する。

## 確認チェックリスト

- ログ形式は構造化されているか
- 機密情報がログやレスポンスへ漏れていないか
- 独自例外と共通例外ハンドラの責務が明確か
- Permissionと認証方式がエンドポイントに合っているか
- ページネーションと検索、レート制限が必要なエンドポイントへ入っているか

## 参考資料

- [django-structlog](https://django-structlog.readthedocs.io/)
- [structlog](https://www.structlog.org/)
- [Django security](https://docs.djangoproject.com/en/4.2/topics/security/)
- [DRF permissions](https://www.django-rest-framework.org/api-guide/permissions/)
