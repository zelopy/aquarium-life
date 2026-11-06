#!/usr/bin/env bash
# deploy.sh 테스트: 가짜 aws로 호출 인자와 순서를 정확히 검증한다.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DIST="$TMP/dist"
LOG="$TMP/aws.log"
mkdir -p "$DIST/assets"
echo '<html></html>' > "$DIST/index.html"
echo 'x' > "$DIST/assets/a.js"

# 작업 폴더에 assets/ 파일을 두어, 스크립트가 assets/* 를 따옴표 없이 쓰면 글롭이 확장되어 실패하게 한다.
WORK="$TMP/work"
mkdir -p "$WORK/assets"
echo 'x' > "$WORK/assets/glob-bait.js"

FAKE="$TMP/fake-aws"
cat > "$FAKE" <<'FAKE_EOF'
#!/usr/bin/env bash
echo "$*" >> "$AWS_LOG"
FAKE_EOF
chmod +x "$FAKE"

FAILED=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILED=1; }

calls() { if [ -f "$LOG" ]; then wc -l < "$LOG" | tr -d ' '; else echo 0; fi; }

# run_case <S3_BUCKET> <DISTRIBUTION_ID> <DIST_DIR>
run() {
  rm -f "$LOG"
  (cd "$WORK" && S3_BUCKET="$1" CLOUDFRONT_DISTRIBUTION_ID="$2" DIST_DIR="$3" \
    AWS_BIN="$FAKE" AWS_LOG="$LOG" bash "$HERE/deploy.sh") >"$TMP/out" 2>"$TMP/err"
}

# 1. S3_BUCKET 없음
if ! run "" "D1" "$DIST" && grep -q 'S3_BUCKET' "$TMP/err" && [ "$(calls)" = 0 ]; then
  pass "S3_BUCKET 비어 있으면 실패"; else fail "S3_BUCKET 비어 있으면 실패"; fi

# 2. CLOUDFRONT_DISTRIBUTION_ID 없음
if ! run "B1" "" "$DIST" && grep -q 'CLOUDFRONT_DISTRIBUTION_ID' "$TMP/err" && [ "$(calls)" = 0 ]; then
  pass "CLOUDFRONT_DISTRIBUTION_ID 비어 있으면 실패"; else fail "CLOUDFRONT_DISTRIBUTION_ID 비어 있으면 실패"; fi

# 3. index.html 없음
mkdir -p "$TMP/empty"
if ! run "B1" "D1" "$TMP/empty" && [ "$(calls)" = 0 ]; then
  pass "index.html 없으면 실패"; else fail "index.html 없으면 실패"; fi

# 4. 정상 실행
EXPECTED="s3 sync $DIST/assets s3://B1/assets --cache-control public,max-age=31536000,immutable
s3 sync $DIST s3://B1 --exclude assets/* --cache-control no-cache
s3 sync $DIST s3://B1 --delete --size-only
cloudfront create-invalidation --distribution-id D1 --paths /index.html /"
if run "B1" "D1" "$DIST" && [ "$(calls)" = 4 ] && [ "$(cat "$LOG")" = "$EXPECTED" ]; then
  pass "정상 실행: aws 호출 4회, 인자와 순서 일치"
else
  fail "정상 실행: aws 호출 4회, 인자와 순서 일치"
  echo "--- expected"; echo "$EXPECTED"; echo "--- actual"; cat "$LOG" 2>/dev/null; cat "$TMP/err"
fi

[ "$FAILED" = 0 ] || exit 1
echo "모든 테스트 통과"
