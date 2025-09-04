#!/usr/bin/env node

/**
 * Insomnia Test Runner for Tiikii Festival API
 * 
 * This script helps validate the OpenAPI specification and provides
 * utilities for running tests with Insomnia.
 * 
 * Usage:
 *   node run-insomnia-tests.js --validate
 *   node run-insomnia-tests.js --check-server
 *   node run-insomnia-tests.js --generate-tests
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  openApiFile: path.join(__dirname, 'openapi.yaml'),
  testConfigFile: path.join(__dirname, 'insomnia-testing-config.json'),
  envFile: path.join(__dirname, 'insomnia-env.json')
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Validate OpenAPI specification file
 */
function validateOpenAPI() {
  logInfo('Validating OpenAPI specification...');
  
  if (!fs.existsSync(CONFIG.openApiFile)) {
    logError(`OpenAPI file not found: ${CONFIG.openApiFile}`);
    return false;
  }

  try {
    const yaml = require('js-yaml');
    const openApiContent = fs.readFileSync(CONFIG.openApiFile, 'utf8');
    const spec = yaml.load(openApiContent);

    // Basic validation
    if (!spec.openapi) {
      logError('Missing OpenAPI version');
      return false;
    }

    if (!spec.info) {
      logError('Missing API info');
      return false;
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      logError('No API paths defined');
      return false;
    }

    // Count endpoints
    let endpointCount = 0;
    Object.values(spec.paths).forEach(path => {
      Object.values(path).forEach(method => {
        if (method.summary) endpointCount++;
      });
    });

    logSuccess(`OpenAPI specification is valid`);
    logInfo(`Found ${endpointCount} endpoints`);
    logInfo(`API Version: ${spec.openapi}`);
    logInfo(`API Title: ${spec.info.title}`);

    return true;
  } catch (error) {
    logError(`OpenAPI validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if server is running and responsive
 */
async function checkServer() {
  logInfo(`Checking server at ${CONFIG.baseUrl}...`);
  
  return new Promise((resolve) => {
    const url = new URL(CONFIG.baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      if (res.statusCode === 200) {
        logSuccess('Server is running and responsive');
        resolve(true);
      } else {
        logWarning(`Server responded with status: ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', (error) => {
      logError(`Server check failed: ${error.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      logError('Server check timed out');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Generate test data for Insomnia
 */
function generateTestData() {
  logInfo('Generating test data...');
  
  const timestamp = Date.now();
  const testData = {
    test_email: `test_${timestamp}@example.com`,
    test_username: `testuser_${timestamp}`,
    test_first_name: 'Test',
    test_last_name: 'User',
    test_password: 'password123',
    test_festival_id: 'test-festival-base',
    test_template_id: 'test-template-base',
    test_artist_id: 'test-artist-001',
    test_room_id: 'test-room-001',
    test_peer_id: 'test-peer-001'
  };

  const envData = {
    development: {
      base_url: CONFIG.baseUrl,
      ...testData,
      auth_token: ''
    }
  };

  try {
    fs.writeFileSync(CONFIG.envFile, JSON.stringify(envData, null, 2));
    logSuccess('Test data generated successfully');
    logInfo(`Test email: ${testData.test_email}`);
    logInfo(`Test username: ${testData.test_username}`);
    return true;
  } catch (error) {
    logError(`Failed to generate test data: ${error.message}`);
    return false;
  }
}

/**
 * Validate Insomnia configuration
 */
function validateInsomniaConfig() {
  logInfo('Validating Insomnia configuration...');
  
  if (!fs.existsSync(CONFIG.testConfigFile)) {
    logError(`Insomnia config file not found: ${CONFIG.testConfigFile}`);
    return false;
  }

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG.testConfigFile, 'utf8'));
    
    if (!config.resources || !Array.isArray(config.resources)) {
      logError('Invalid Insomnia configuration format');
      return false;
    }

    const requests = config.resources.filter(r => r._type === 'request');
    const environments = config.resources.filter(r => r._type === 'environment');
    const testSuites = config.resources.filter(r => r._type === 'unit_test_suite');

    logSuccess('Insomnia configuration is valid');
    logInfo(`Found ${requests.length} requests`);
    logInfo(`Found ${environments.length} environments`);
    logInfo(`Found ${testSuites.length} test suites`);

    return true;
  } catch (error) {
    logError(`Insomnia config validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Display usage information
 */
function showUsage() {
  log('Tiikii Festival API - Insomnia Test Runner', 'bright');
  log('');
  log('Usage: node run-insomnia-tests.js [options]', 'cyan');
  log('');
  log('Options:', 'yellow');
  log('  --validate        Validate OpenAPI specification');
  log('  --check-server    Check if server is running');
  log('  --generate-tests  Generate test data');
  log('  --validate-config Validate Insomnia configuration');
  log('  --all             Run all validations');
  log('  --help            Show this help message');
  log('');
  log('Examples:', 'yellow');
  log('  node run-insomnia-tests.js --validate');
  log('  node run-insomnia-tests.js --check-server');
  log('  node run-insomnia-tests.js --all');
  log('');
  log('Environment Variables:', 'yellow');
  log('  API_BASE_URL      Base URL for API (default: http://localhost:3000)');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    showUsage();
    return;
  }

  let allPassed = true;

  if (args.includes('--validate') || args.includes('--all')) {
    allPassed = validateOpenAPI() && allPassed;
  }

  if (args.includes('--check-server') || args.includes('--all')) {
    const serverOk = await checkServer();
    allPassed = serverOk && allPassed;
  }

  if (args.includes('--generate-tests') || args.includes('--all')) {
    allPassed = generateTestData() && allPassed;
  }

  if (args.includes('--validate-config') || args.includes('--all')) {
    allPassed = validateInsomniaConfig() && allPassed;
  }

  log('');
  if (allPassed) {
    logSuccess('All validations passed! Ready for Insomnia testing.');
    log('');
    log('Next steps:', 'cyan');
    log('1. Open Insomnia');
    log('2. Import openapi.yaml file');
    log('3. Import insomnia-testing-config.json file');
    log('4. Start testing!');
  } else {
    logError('Some validations failed. Please fix the issues before testing.');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Run main function
main().catch((error) => {
  logError(`Script failed: ${error.message}`);
  process.exit(1);
});
