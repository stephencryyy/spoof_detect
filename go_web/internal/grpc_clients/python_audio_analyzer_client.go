package grpc_clients

import (
	"context"
	"fmt"
	"time"

	pb "example.com/auth_service/gen/proto" // Путь к сгенерированному pb
	"example.com/auth_service/pkg/logger"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// PythonAudioAnalyzerClient defines the interface for interacting with the Python audio analysis gRPC service.
type PythonAudioAnalyzerClient interface {
	AnalyzeAudio(ctx context.Context, minioBucketName, minioObjectKey string) (*pb.AnalyzeAudioResponse, error)
	Close() error
}

type pythonAudioAnalyzerClientImpl struct {
	conn   *grpc.ClientConn
	client pb.AudioAnalysisClient
	logger *logger.Logger
}

// NewPythonAudioAnalyzerClient creates a new client for the Python audio analysis gRPC service.
func NewPythonAudioAnalyzerClient(ctx context.Context, targetAddress string, appLogger *logger.Logger) (PythonAudioAnalyzerClient, error) {
	appLogger.Info("Connecting to Python gRPC Audio Analysis service", zap.String("address", targetAddress))

	// TODO: Add options for TLS, keepalive, etc., as needed for production.
	// For now, using insecure credentials for simplicity.
	conn, err := grpc.NewClient(targetAddress,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(), // Block until connection is up, or context times out
	)
	if err != nil {
		appLogger.Error("Failed to connect to Python gRPC service", zap.Error(err), zap.String("address", targetAddress))
		return nil, fmt.Errorf("failed to connect to Python gRPC service at %s: %w", targetAddress, err)
	}

	client := pb.NewAudioAnalysisClient(conn)
	appLogger.Info("Successfully connected to Python gRPC Audio Analysis service", zap.String("address", targetAddress))

	return &pythonAudioAnalyzerClientImpl{
		conn:   conn,
		client: client,
		logger: appLogger,
	}, nil
}

func (c *pythonAudioAnalyzerClientImpl) AnalyzeAudio(ctx context.Context, minioBucketName, minioObjectKey string) (*pb.AnalyzeAudioResponse, error) {
	c.logger.Debug("Sending AnalyzeAudio request to Python gRPC service",
		zap.String("bucket", minioBucketName),
		zap.String("key", minioObjectKey))

	req := &pb.AnalyzeAudioRequest{
		MinioBucketName: minioBucketName,
		MinioObjectKey:  minioObjectKey,
	}

	// Set a timeout for the gRPC call itself, if not already handled by the calling context.
	// Example: 5 minutes, as suggested in WhatNeed.md
	callCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	resp, err := c.client.AnalyzeAudio(callCtx, req)
	if err != nil {
		c.logger.Error("Python gRPC AnalyzeAudio call failed",
			zap.Error(err),
			zap.String("bucket", minioBucketName),
			zap.String("key", minioObjectKey))
		// TODO: Potentially map gRPC error codes (e.g., codes.Unavailable) to more specific application errors.
		return nil, fmt.Errorf("gRPC AnalyzeAudio call failed: %w", err)
	}

	if resp.ErrorMessage != "" {
		c.logger.Warn("Python gRPC service returned an error message",
			zap.String("python_error", resp.ErrorMessage),
			zap.String("bucket", minioBucketName),
			zap.String("key", minioObjectKey))
		// This is an application-level error from the Python service, not a gRPC transport error.
		// We still return the response, and the handler can decide what to do based on ErrorMessage.
	}

	c.logger.Debug("Received AnalyzeAudio response from Python gRPC service",
		zap.Int("prediction_count", len(resp.Predictions)),
		zap.Bool("has_error_message", resp.ErrorMessage != ""))

	return resp, nil
}

func (c *pythonAudioAnalyzerClientImpl) Close() error {
	c.logger.Info("Closing connection to Python gRPC Audio Analysis service")
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}
