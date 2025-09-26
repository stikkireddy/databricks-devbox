package main

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const maxLogSize = 1024 * 1024 // 1MB

type ProcessLogger struct {
	logsDir string
	mutex   sync.RWMutex
}

func NewProcessLogger() *ProcessLogger {
	logsDir := "logs"
	os.MkdirAll(logsDir, 0755)
	return &ProcessLogger{
		logsDir: logsDir,
	}
}

func (pl *ProcessLogger) getServerLogDir(serverID string) string {
	serverLogDir := filepath.Join(pl.logsDir, serverID)
	os.MkdirAll(serverLogDir, 0755)
	return serverLogDir
}

func (pl *ProcessLogger) getLogFilePath(serverID string) string {
	return filepath.Join(pl.getServerLogDir(serverID), "process.log")
}

func (pl *ProcessLogger) rotateLogIfNeeded(logFile string) error {
	pl.mutex.Lock()
	defer pl.mutex.Unlock()

	info, err := os.Stat(logFile)
	if err != nil {
		return nil // File doesn't exist yet
	}

	if info.Size() <= maxLogSize {
		return nil // No rotation needed
	}

	log.Printf("Rotating log file %s (size: %d bytes)", logFile, info.Size())

	// Create backup filename with timestamp
	timestamp := time.Now().Format("20060102_150405")
	backupFile := filepath.Join(filepath.Dir(logFile), fmt.Sprintf("process_%s.log", timestamp))

	// Move current log to backup
	if err := os.Rename(logFile, backupFile); err != nil {
		return err
	}

	log.Printf("Rotated log to: %s", backupFile)

	// Clean up old logs (keep only 5 most recent)
	pl.cleanupOldLogs(filepath.Dir(logFile))

	return nil
}

func (pl *ProcessLogger) cleanupOldLogs(logDir string) {
	matches, err := filepath.Glob(filepath.Join(logDir, "process_*.log"))
	if err != nil {
		return
	}

	// Keep only the 5 most recent files
	if len(matches) <= 5 {
		return
	}

	// Sort by modification time and remove oldest
	for i := 5; i < len(matches); i++ {
		os.Remove(matches[i])
		log.Printf("Removed old log file: %s", matches[i])
	}
}

func (pl *ProcessLogger) LogProcessOutput(serverID, serverName, output string, isError bool) {
	logFile := pl.getLogFilePath(serverID)

	// Check if rotation is needed
	pl.rotateLogIfNeeded(logFile)

	// Open log file for appending
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Failed to open log file %s: %v", logFile, err)
		return
	}
	defer file.Close()

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logLevel := "INFO"
	prefix := "STDOUT"
	if isError {
		logLevel = "ERROR"
		prefix = "STDERR"
	}

	// Write log entry
	logEntry := fmt.Sprintf("%s - process_%s - %s - %s: %s\n", timestamp, serverID, logLevel, prefix, output)
	file.WriteString(logEntry)
}

func (pl *ProcessLogger) LogProcessEvent(serverID, serverName, event, details string) {
	logFile := pl.getLogFilePath(serverID)

	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Failed to open log file %s: %v", logFile, err)
		return
	}
	defer file.Close()

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	message := fmt.Sprintf("PROCESS EVENT: %s", event)
	if details != "" {
		message += fmt.Sprintf(" - %s", details)
	}

	logEntry := fmt.Sprintf("%s - process_%s - INFO - %s\n", timestamp, serverID, message)
	file.WriteString(logEntry)
}

func (pl *ProcessLogger) GetRecentLogs(serverID string, lines int) ([]string, error) {
	logFile := pl.getLogFilePath(serverID)

	file, err := os.Open(logFile)
	if err != nil {
		return []string{}, nil // Return empty if file doesn't exist
	}
	defer file.Close()

	var allLines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		allLines = append(allLines, scanner.Text())
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Return last 'lines' number of lines
	if len(allLines) <= lines {
		return allLines, nil
	}

	return allLines[len(allLines)-lines:], nil
}

func (pl *ProcessLogger) CleanupServerLogs(serverID string) {
	serverLogDir := pl.getServerLogDir(serverID)
	os.RemoveAll(serverLogDir)
	log.Printf("Cleaned up log directory for server %s", serverID)
}

// ProcessOutputCapture captures stdout and stderr from a process
type ProcessOutputCapture struct {
	logger     *ProcessLogger
	serverID   string
	serverName string
}

func NewProcessOutputCapture(logger *ProcessLogger, serverID, serverName string) *ProcessOutputCapture {
	return &ProcessOutputCapture{
		logger:     logger,
		serverID:   serverID,
		serverName: serverName,
	}
}

func (poc *ProcessOutputCapture) CaptureOutput(stdout, stderr io.Reader) {
	// Capture stdout
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			if line != "" {
				poc.logger.LogProcessOutput(poc.serverID, poc.serverName, line, false)
			}
		}
	}()

	// Capture stderr
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			if line != "" {
				poc.logger.LogProcessOutput(poc.serverID, poc.serverName, line, true)
			}
		}
	}()
}
