# AWS Deployment Guide

This guide explains how to deploy the AI Flock system to AWS using ECS Fargate.

## Architecture Overview

The AWS deployment uses:
- **ECS Fargate** for serverless container orchestration
- **NATS** as a containerized service for messaging
- **EFS** for shared persistent storage
- **Service Discovery** for internal DNS resolution
- **CloudWatch** for logging and monitoring
- **VPC** with public/private subnets for network isolation

## Prerequisites

1. AWS CLI installed and configured
2. Docker installed locally
3. AWS account with appropriate permissions
4. jq installed (for monitoring script)

## Quick Deployment

```bash
# Deploy the entire stack (builds, pushes image, creates infrastructure)
cd aws/scripts
./deploy.sh

# Monitor the deployment
./monitor.sh

# Clean up everything when done
./cleanup.sh
```

## Step-by-Step Deployment

### 1. Build and Push Agent Image

```bash
# Build the agent image
cd agents
docker build -t ai-flock-agent .

# Create ECR repository
aws ecr create-repository --repository-name ai-flock-agent --region us-east-1

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag ai-flock-agent:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/ai-flock-agent:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/ai-flock-agent:latest
```

### 2. Deploy CloudFormation Stack

```bash
aws cloudformation deploy \
    --template-file aws/cloudformation.yaml \
    --stack-name ai-flock \
    --parameter-overrides AgentCount=3 \
    --capabilities CAPABILITY_IAM \
    --region us-east-1
```

### 3. Verify Deployment

```bash
# Get cluster name
CLUSTER_NAME=$(aws cloudformation describe-stacks \
    --stack-name ai-flock \
    --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" \
    --output text)

# List running tasks
aws ecs list-tasks --cluster $CLUSTER_NAME

# View agent logs
aws logs tail /ecs/ai-flock-agent --follow
```

## Configuration

### Environment Variables

The deployment scripts accept these environment variables:

- `STACK_NAME`: CloudFormation stack name (default: ai-flock)
- `AWS_REGION`: AWS region (default: us-east-1)
- `AGENT_COUNT`: Number of agent tasks (default: 3)

Example:
```bash
AGENT_COUNT=5 AWS_REGION=us-west-2 ./deploy.sh
```

### CloudFormation Parameters

The CloudFormation template accepts these parameters:

- `VpcCIDR`: VPC CIDR block (default: 10.0.0.0/16)
- `PublicSubnetCIDR`: Public subnet CIDR (default: 10.0.1.0/24)
- `PrivateSubnetCIDR`: Private subnet CIDR (default: 10.0.2.0/24)
- `AgentCount`: Number of agent tasks (default: 3, max: 10)

## Scaling

### Scale Agents

```bash
# Scale to 5 agents
aws ecs update-service \
    --cluster ai-flock-cluster \
    --service ai-flock-agent \
    --desired-count 5
```

### Auto-Scaling

To enable auto-scaling, add an Application Auto Scaling policy:

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/ai-flock-cluster/ai-flock-agent \
    --min-capacity 1 \
    --max-capacity 10

# Add scaling policy
aws application-autoscaling put-scaling-policy \
    --policy-name ai-flock-cpu-scaling \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/ai-flock-cluster/ai-flock-agent \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
        }
    }'
```

## Monitoring

### CloudWatch Logs

View logs in the AWS Console or CLI:

```bash
# NATS logs
aws logs tail /ecs/ai-flock-nats --follow

# Agent logs
aws logs tail /ecs/ai-flock-agent --follow

# Filter logs by agent ID
aws logs filter-log-events \
    --log-group-name /ecs/ai-flock-agent \
    --filter-pattern "[agent-1]"
```

### CloudWatch Metrics

Key metrics to monitor:
- ECS Service CPU/Memory utilization
- Task count
- EFS throughput and burst credits
- NATS connection count

### Container Insights

Container Insights is enabled by default, providing:
- Task-level CPU and memory metrics
- Network performance metrics
- Disk I/O metrics

## Security Considerations

The deployment includes several security features:

1. **Network Isolation**: Agents run in private subnets
2. **Security Groups**: Restrictive firewall rules
3. **IAM Roles**: Minimal permissions following least privilege
4. **EFS Encryption**: Data encrypted at rest and in transit
5. **Read-only Root**: Agent containers have read-only root filesystem
6. **Dropped Capabilities**: All Linux capabilities dropped
7. **Resource Limits**: CPU and memory limits enforced

## Cost Optimization

### Fargate Spot

To use Fargate Spot for cost savings (up to 70% discount):

```yaml
# Add to AgentService in CloudFormation:
CapacityProviderStrategy:
  - CapacityProvider: FARGATE_SPOT
    Weight: 1
  - CapacityProvider: FARGATE
    Weight: 0
```

### EFS Lifecycle

Enable lifecycle management to move infrequently accessed files to cheaper storage:

```bash
aws efs put-lifecycle-configuration \
    --file-system-id <efs-id> \
    --lifecycle-policies TransitionToIA=AFTER_30_DAYS
```

## Troubleshooting

### Common Issues

1. **Tasks failing to start**
   - Check ECR image exists and is accessible
   - Verify IAM roles have correct permissions
   - Check security groups allow communication

2. **Agents can't connect to NATS**
   - Verify NATS service is healthy
   - Check Service Discovery is working
   - Ensure security groups allow port 4222

3. **EFS mount failures**
   - Verify mount targets are in correct subnets
   - Check security group allows NFS (port 2049)
   - Ensure EFS access point has correct permissions

### Debug Commands

```bash
# Describe task failures
aws ecs describe-tasks \
    --cluster ai-flock-cluster \
    --tasks <task-arn> \
    --query 'tasks[0].stoppedReason'

# Check service events
aws ecs describe-services \
    --cluster ai-flock-cluster \
    --services ai-flock-agent \
    --query 'services[0].events[:5]'

# Test NATS connectivity (run in VPC)
docker run --rm -it natsio/nats-box:latest \
    nats sub -s nats://nats.ai-flock.local:4222 ">"
```

## Alternative Deployment Options

### EKS (Kubernetes)

For Kubernetes deployment, use Helm:

```bash
# Install NATS
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm install nats nats/nats

# Deploy agents
kubectl apply -f k8s/agent-deployment.yaml
```

### EC2 with Docker Compose

For simpler single-instance deployment:

```bash
# Launch EC2 instance with Docker
# Copy docker-compose.yml and agent code
# Run: docker-compose up -d --scale agent=5
```

### Lambda + SQS

For serverless event-driven architecture:
- Replace NATS with SQS/SNS
- Deploy agents as Lambda functions
- Use S3 for shared storage
- Use Step Functions for orchestration

## Cleanup

To remove all AWS resources:

```bash
./aws/scripts/cleanup.sh
```

Or manually:

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name ai-flock

# Delete ECR repository
aws ecr delete-repository --repository-name ai-flock-agent --force

# Delete CloudWatch logs
aws logs delete-log-group --log-group-name /ecs/ai-flock-nats
aws logs delete-log-group --log-group-name /ecs/ai-flock-agent
```