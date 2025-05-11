package s3service

import (
	"context"
	"fmt"
	"io"
	"strings"

	"example.com/auth_service/internal/config"
	"example.com/auth_service/pkg/logger"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
)

// S3Service provides methods to interact with S3-compatible storage.
type S3Service struct {
	client     *s3.Client
	bucketName string
	logger     *logger.Logger
	endpoint   string
}

// NewS3Service creates a new S3Service.
func NewS3Service(cfg config.S3Config, appLogger *logger.Logger) (*S3Service, error) {
	var awsSDKConfig aws.Config
	var err error

	// Custom resolver for endpoint (required for MinIO and other S3-compatible services)
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if service == s3.ServiceID {
			return aws.Endpoint{
				URL:               cfg.Endpoint,
				HostnameImmutable: true, // Important for MinIO to prevent AWS domain prepending
				Source:            aws.EndpointSourceCustom,
			}, nil
		}
		// Fallback to default resolver for other services
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	// Load AWS configuration
	// For MinIO, region might not be strictly necessary but SDK expects it.
	// Static credentials are used here as per common practice for MinIO or specific IAM user for S3.
	awsSDKConfig, err = awsconfig.LoadDefaultConfig(context.TODO(),
		awsconfig.WithRegion(cfg.Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS SDK config: %w", err)
	}

	// Create an S3 client
	// For MinIO, UsePathStyle should be true.
	s3Client := s3.NewFromConfig(awsSDKConfig, func(o *s3.Options) {
		o.UsePathStyle = cfg.UsePathStyle // Important for MinIO
	})

	appLogger.Info("S3 Service initialized",
		zap.String("endpoint", cfg.Endpoint),
		zap.String("bucket", cfg.BucketName),
		zap.String("region", cfg.Region),
		zap.Bool("use_path_style", cfg.UsePathStyle))

	return &S3Service{
		client:     s3Client,
		bucketName: cfg.BucketName,
		logger:     appLogger,
		endpoint:   cfg.Endpoint,
	}, nil
}

// UploadFile uploads a file to the S3 bucket.
// s3Key is the full path/name of the object in the bucket.
// file is an io.Reader for the file content.
// contentType is the MIME type of the file (e.g., "audio/mpeg").
func (s *S3Service) UploadFile(ctx context.Context, s3Key string, file io.Reader, contentType string) (string, error) {
	params := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucketName),
		Key:         aws.String(s3Key),
		Body:        file,
		ContentType: aws.String(contentType),
		// ACL: types.ObjectCannedACLPublicRead, // Optional: if you want files to be publicly readable
	}

	_, err := s.client.PutObject(ctx, params)
	if err != nil {
		s.logger.Error("Failed to upload file to S3",
			zap.String("bucket", s.bucketName),
			zap.String("key", s3Key),
			zap.Error(err))
		return "", fmt.Errorf("failed to upload file to S3 bucket %s with key %s: %w", s.bucketName, s3Key, err)
	}

	// Construct the URL. This can be complex depending on public/private, CDN, etc.
	// For a simple MinIO setup, it might be: endpoint/bucketName/s3Key
	fileURL := fmt.Sprintf("%s/%s/%s", strings.TrimSuffix(s.endpoint, "/"), s.bucketName, s3Key)
	s.logger.Info("File uploaded successfully to S3", zap.String("key", s3Key), zap.String("url", fileURL))

	return fileURL, nil
}

// DeleteFile (Optional) - implement if needed
// func (s *S3Service) DeleteFile(ctx context.Context, s3Key string) error {
// 	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
// 		Bucket: aws.String(s.bucketName),
// 		Key:    aws.String(s3Key),
// 	})
// 	if err != nil {
// 		return fmt.Errorf("failed to delete file from S3: %w", err)
// 	}
// 	return nil
// }

// GetPresignedURL (Optional) - for generating temporary access URLs to private objects
// func (s *S3Service) GetPresignedURL(ctx context.Context, s3Key string, lifetimeSecs int64) (string, error) {
// 	presignClient := s3.NewPresignClient(s.client)
// 	presignedURL, err := presignClient.PresignPutObject(ctx,
// 		&s3.PutObjectInput{
// 			Bucket: aws.String(s.bucketName),
// 			Key:    aws.String(s3Key),
// 		},
// 		s3.WithPresignExpires(time.Duration(lifetimeSecs*int64(time.Second))),
// 	)
// 	if err != nil {
// 		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
// 	}
// 	return presignedURL.URL, nil
// }
