#!/usr/bin/env bash
set -euo pipefail

# Configuration
STACK_NAME=${STACK_NAME:-ai-flock}
AWS_REGION=${AWS_REGION:-us-east-1}
AGENT_COUNT=${AGENT_COUNT:-3}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if logged in to AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo_error "Not logged in to AWS. Please configure AWS CLI credentials."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo_info "AWS Account ID: $ACCOUNT_ID"
echo_info "Region: $AWS_REGION"

# Step 1: Build and push Docker image
echo_info "Building Docker image..."
cd agents
docker build -t ai-flock-agent .

# Create ECR repository if it doesn't exist
echo_info "Creating ECR repository..."
aws ecr describe-repositories --repository-names ai-flock-agent --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name ai-flock-agent --region $AWS_REGION

# Get ECR login token
echo_info "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag and push image with retry logic
ECR_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ai-flock-agent"
echo_info "Pushing image to ECR: $ECR_URI"
docker tag ai-flock-agent:latest $ECR_URI:latest

# Push with retry logic
echo_info "Pushing Docker image (this may take a few minutes)..."
for attempt in {1..3}; do
    echo_info "Push attempt $attempt/3..."
    if docker push $ECR_URI:latest; then
        echo_info "Docker push successful!"
        break
    else
        if [ $attempt -eq 3 ]; then
            echo_error "Docker push failed after 3 attempts"
            exit 1
        fi
        echo_warn "Push attempt $attempt failed, retrying in 10 seconds..."
        sleep 10
    fi
done

cd ..

# Step 2: Deploy CloudFormation stack
echo_info "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file aws/cloudformation.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides AgentCount=$AGENT_COUNT \
    --capabilities CAPABILITY_IAM \
    --region $AWS_REGION

# Step 3: Get outputs
echo_info "Getting stack outputs..."
CLUSTER_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" \
    --output text \
    --region $AWS_REGION)

NATS_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='NATSServiceEndpoint'].OutputValue" \
    --output text \
    --region $AWS_REGION)

EFS_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='FileSystemId'].OutputValue" \
    --output text \
    --region $AWS_REGION)

echo_info "Deployment complete!"
echo ""
echo "========================================="
echo "Cluster Name: $CLUSTER_NAME"
echo "NATS Endpoint: $NATS_ENDPOINT"
echo "EFS File System: $EFS_ID"
echo "========================================="
echo ""
echo "To view running tasks:"
echo "  aws ecs list-tasks --cluster $CLUSTER_NAME --region $AWS_REGION"
echo ""
echo "To view logs:"
echo "  aws logs tail /ecs/ai-flock-agent --follow --region $AWS_REGION"
echo ""
echo "To scale agents:"
echo "  aws ecs update-service --cluster $CLUSTER_NAME --service ai-flock-agent --desired-count N --region $AWS_REGION"