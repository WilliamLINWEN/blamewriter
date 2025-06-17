/**
 * Environment Variables Validation Utility
 *
 * This module provides functions to validate that all required environment
 * variables are present and properly configured before the server starts.
 */

interface EnvironmentConfig {
  PORT: string;
  NODE_ENV: string;
  BITBUCKET_APP_SECRET: string;
  OPENAI_API_KEY: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  config?: EnvironmentConfig | undefined;
}

/**
 * List of required environment variables with their descriptions
 */
const REQUIRED_ENV_VARS = {
  PORT: 'Server port configuration',
  NODE_ENV: 'Environment mode (development/production)',
  BITBUCKET_APP_SECRET: 'Bitbucket API authentication secret',
  OPENAI_API_KEY: 'OpenAI API access key',
} as const;

/**
 * Validates that all required environment variables are present and not empty
 * @returns ValidationResult object with validation status and any errors
 */
export function validateEnvironmentVariables(): ValidationResult {
  const errors: string[] = [];
  const config: Partial<EnvironmentConfig> = {};

  // Check each required environment variable
  for (const [varName, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[varName];

    if (!value) {
      errors.push(`❌ ${varName} is not set (${description})`);
    } else if (value.trim() === '') {
      errors.push(`❌ ${varName} is empty (${description})`);
    } else if (isPlaceholderValue(value)) {
      errors.push(
        `❌ ${varName} contains placeholder value - please set a real value (${description})`,
      );
    } else {
      config[varName as keyof EnvironmentConfig] = value;
    }
  }

  // Additional validation for specific variables
  if (config.PORT && !isValidPort(config.PORT)) {
    errors.push(`❌ PORT must be a valid number between 1 and 65535, got: ${config.PORT}`);
  }

  if (config.NODE_ENV && !isValidNodeEnv(config.NODE_ENV)) {
    errors.push(
      `❌ NODE_ENV must be 'development', 'production', or 'test', got: ${config.NODE_ENV}`,
    );
  }

  if (config.OPENAI_API_KEY && !isValidOpenAIKey(config.OPENAI_API_KEY)) {
    errors.push("❌ OPENAI_API_KEY appears to be invalid format (should start with 'sk-')");
  }

  return {
    isValid: errors.length === 0,
    errors,
    config: errors.length === 0 ? (config as EnvironmentConfig) : undefined,
  };
}

/**
 * Checks if a value appears to be a placeholder that needs to be replaced
 */
function isPlaceholderValue(value: string): boolean {
  const placeholderPatterns = [
    /your_.*_here/i,
    /replace_this/i,
    /change_me/i,
    /placeholder/i,
    /example/i,
  ];

  return placeholderPatterns.some(pattern => pattern.test(value));
}

/**
 * Validates that a port number is valid
 */
function isValidPort(port: string): boolean {
  const portNum = parseInt(port, 10);
  return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
}

/**
 * Validates that NODE_ENV has a valid value
 */
function isValidNodeEnv(env: string): boolean {
  return ['development', 'production', 'test'].includes(env.toLowerCase());
}

/**
 * Basic validation for OpenAI API key format
 */
function isValidOpenAIKey(key: string): boolean {
  return key.startsWith('sk-') && key.length > 10;
}

/**
 * Prints environment validation results to console
 */
export function printValidationResults(result: ValidationResult): void {
  if (result.isValid) {
    console.log('✅ Environment validation passed');
    console.log('📊 Configuration loaded:');
    console.log(`   - PORT: ${result.config?.PORT}`);
    console.log(`   - NODE_ENV: ${result.config?.NODE_ENV}`);
    console.log(
      `   - BITBUCKET_APP_SECRET: ${result.config?.BITBUCKET_APP_SECRET ? '***configured***' : 'not set'}`,
    );
    console.log(
      `   - OPENAI_API_KEY: ${result.config?.OPENAI_API_KEY ? '***configured***' : 'not set'}`,
    );
  } else {
    console.error('❌ Environment validation failed:');
    result.errors.forEach(error => console.error(`   ${error}`));
    console.error('\n💡 Please check your .env file and ensure all required variables are set.');
    console.error('   You can copy .env.example to .env and fill in the values.');
  }
}

/**
 * Validates environment and exits process if validation fails
 * This should be called during server startup
 */
export function validateEnvironmentOrExit(): EnvironmentConfig {
  const result = validateEnvironmentVariables();

  printValidationResults(result);

  if (!result.isValid) {
    console.error('\n🚨 Server cannot start with invalid environment configuration');
    process.exit(1);
  }

  return result.config!;
}
