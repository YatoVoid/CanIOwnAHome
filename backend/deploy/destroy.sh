#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build && [ -f build/lambda.zip ] || : > build/lambda.zip
terraform destroy -auto-approve -input=false
rm -rf build .terraform terraform.tfstate*
