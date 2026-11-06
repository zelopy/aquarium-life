#!/usr/bin/env bash
# 빌드된 dist/ 를 S3에 올리고 CloudFront 캐시를 무효화한다.
# 필요한 환경 변수: S3_BUCKET, CLOUDFRONT_DISTRIBUTION_ID
# 선택: AWS_BIN(기본 aws), DIST_DIR(기본 dist)
set -euo pipefail

# Git Bash(MSYS)가 /index.html 같은 인자를 Windows 경로로 바꾸지 않게 한다. Linux에서는 영향 없음.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

AWS_BIN="${AWS_BIN:-aws}"
DIST_DIR="${DIST_DIR:-dist}"

if [ -z "${S3_BUCKET:-}" ]; then
  echo "오류: S3_BUCKET 환경 변수가 필요합니다." >&2
  exit 1
fi
if [ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "오류: CLOUDFRONT_DISTRIBUTION_ID 환경 변수가 필요합니다." >&2
  exit 1
fi
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "오류: $DIST_DIR/index.html 이 없습니다. 먼저 빌드하세요." >&2
  exit 1
fi

echo "[1/4] assets 업로드 (해시 파일명, 1년 캐시)"
"$AWS_BIN" s3 sync "$DIST_DIR/assets" "s3://$S3_BUCKET/assets" \
  --cache-control public,max-age=31536000,immutable

echo "[2/4] 나머지 파일 업로드 (no-cache)"
"$AWS_BIN" s3 sync "$DIST_DIR" "s3://$S3_BUCKET" \
  --exclude 'assets/*' --cache-control no-cache

# --size-only: 앞 단계에서 Cache-Control을 붙여 올린 파일을 다시 올려
# 메타데이터를 잃지 않게 한다. 여기서는 삭제만 하려는 것이다.
echo "[3/4] 사라진 파일 삭제"
"$AWS_BIN" s3 sync "$DIST_DIR" "s3://$S3_BUCKET" --delete --size-only

echo "[4/4] CloudFront 캐시 무효화"
"$AWS_BIN" cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths /index.html /

echo "배포 완료"
