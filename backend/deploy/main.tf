provider "aws" {
  region = var.region
}

resource "aws_iam_role" "lambda" {
  name = "${var.function_name}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Package is built by apply.sh (build/lambda.zip is too large for direct upload, so it goes via S3).
resource "aws_s3_bucket" "pkg" {
  bucket_prefix = "${var.function_name}-pkg-"
  force_destroy = true
}

resource "aws_s3_object" "pkg" {
  bucket = aws_s3_bucket.pkg.id
  key    = "lambda.zip"
  source = "${path.module}/build/lambda.zip"
  etag   = filemd5("${path.module}/build/lambda.zip")
}

resource "aws_lambda_function" "model" {
  function_name     = var.function_name
  role              = aws_iam_role.lambda.arn
  runtime           = "python3.12"
  handler           = "handler.handler"
  architectures     = ["x86_64"]
  memory_size       = 1024
  timeout           = 30
  s3_bucket         = aws_s3_bucket.pkg.id
  s3_key            = aws_s3_object.pkg.key
  s3_object_version = aws_s3_object.pkg.version_id
  source_code_hash  = filebase64sha256("${path.module}/build/lambda.zip")
  depends_on        = [aws_iam_role_policy_attachment.logs]
}

resource "aws_lambda_function_url" "model" {
  function_name      = aws_lambda_function.model.function_name
  authorization_type = "NONE"
}

# Function URLs with NONE auth need both of these permissions for public access.
resource "aws_lambda_permission" "url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.model.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "invoke" {
  statement_id  = "FunctionURLInvokeAllowPublicAccess"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.model.function_name
  principal     = "*"
}

