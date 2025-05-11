package logger

import (
	"fmt"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger wraps a zap.SugaredLogger for application-wide logging.
// Using SugaredLogger for more convenient, loosely-typed logging.
// For performance-critical parts, consider using zap.Logger directly.
type Logger struct {
	*zap.SugaredLogger
}

// New creates a new Logger instance based on the provided level and format.
// level can be "debug", "info", "warn", "error", "dpanic", "panic", "fatal".
// format can be "console" or "json".
func New(level string, format string) (*Logger, error) {
	logLevel, err := zapcore.ParseLevel(level)
	if err != nil {
		logLevel = zapcore.InfoLevel // Default to info level on parse error
		fmt.Fprintf(os.Stderr, "Invalid log level '%s', defaulting to 'info'. Error: %v\n", level, err)
	}

	var encoderCfg zapcore.EncoderConfig
	var encoder zapcore.Encoder

	if format == "json" {
		encoderCfg = zap.NewProductionEncoderConfig()
		encoderCfg.TimeKey = "timestamp" // Common practice for JSON logs
		encoderCfg.EncodeTime = zapcore.ISO8601TimeEncoder
		encoder = zapcore.NewJSONEncoder(encoderCfg)
	} else { // Default to console format
		encoderCfg = zap.NewDevelopmentEncoderConfig()
		encoderCfg.EncodeLevel = zapcore.CapitalColorLevelEncoder // Colored output for console
		encoder = zapcore.NewConsoleEncoder(encoderCfg)
	}

	core := zapcore.NewCore(
		encoder,
		zapcore.Lock(os.Stdout), // Write to stdout, could also be a file
		logLevel,
	)

	// Add caller and stacktrace for error levels and above
	zapLogger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	sugaredLogger := zapLogger.Sugar()

	return &Logger{SugaredLogger: sugaredLogger}, nil
}

// Ensure all buffered logs are written before application exit.
// Call this with `defer logger.Sync()` in your main function.
// Note: Sync can return an error which you might want to handle.
// For simplicity here, we're not handling its error explicitly in this wrapper.
func (l *Logger) Sync() error {
	return l.SugaredLogger.Sync()
}

// Example of adding structured context to logs
// func (l *Logger) WithContext(fields ...interface{}) *Logger {
// 	return &Logger{l.SugaredLogger.With(fields...)}
// }
