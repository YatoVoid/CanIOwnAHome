#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

rm -rf build && mkdir -p build/pkg
pip install -q --target build/pkg --platform manylinux_2_28_x86_64 --platform manylinux_2_27_x86_64 --platform manylinux2014_x86_64 --implementation cp \
  --python-version 3.12 --only-binary=:all: --upgrade scikit-learn==1.8.0 numpy joblib
find build/pkg -type d \( -name tests -o -name __pycache__ \) -prune -exec rm -rf {} +
rm -rf build/pkg/*.dist-info
python3 -m venv build/venv && build/venv/bin/pip install -q pandas numpy
build/venv/bin/python -W ignore build_data.py ../houston_housing_2024.csv build/pkg/listings.json
cp handler.py rent_handler.py ../houston_model.joblib build/pkg/
(cd build/pkg && zip -qr ../lambda.zip .)

terraform init -input=false
terraform apply -auto-approve -input=false
U=$(terraform output -raw api_url)
echo "Base URL:        $U"
echo "Predict:         ${U}predict"
echo "Rent-to-own:     ${U}rent-to-own"
