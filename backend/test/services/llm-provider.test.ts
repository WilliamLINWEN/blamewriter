import {
  BaseLLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  GenerateDescriptionOptions,
  GeneratedDescription,
  LLMProviderError,
  LLMProviderErrorCode,
} from '../../src/services/llm-provider';

// A minimal concrete implementation of BaseLLMProvider for testing
class TestLLMProvider extends BaseLLMProvider {
  constructor(config: LLMProviderConfig = {}) {
    super(LLMProviderType.OPENAI, config); // Type doesn't matter much for these tests
  }

  // Mock implementation for the abstract method
  protected async executeLLMGeneration(
    prompt: string,
    options?: GenerateDescriptionOptions,
  ): Promise<Omit<GeneratedDescription, 'diffSizeTruncated' | 'originalDiffSize' | 'truncatedDiffSize'>> {
    return {
      description: `Mocked response for prompt: ${prompt}`,
      model: options?.model || 'test-model',
      provider: this.providerType,
      tokensUsed: 100,
      metadata: { processedPrompt: prompt },
    };
  }

  // Making protected methods public for testing
  public publicProcessTemplate(template: string, templateVars?: Record<string, string>): string {
    return super.processTemplate(template, templateVars);
  }

  public publicValidateTemplate(template: string): { isValid: boolean; errors: string[] } {
    return super.validateTemplate(template);
  }

  public publicGetDefaultPromptTemplate(): string {
    return super.getDefaultPromptTemplate();
  }

  // Other abstract methods that need mock implementations if BaseLLMProvider calls them.
  // For now, these are not directly involved in template processing tests.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async testConnection(): Promise<boolean> { return true; }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  getCapabilities() { return { maxTokens: 1000, supportedModels: ['test-model'], supportsStreaming: false }; }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async validateConfig(): Promise<boolean> { return true; }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async getAvailableModels(): Promise<string[]> { return ['test-model']; }
}

describe('BaseLLMProvider Template Processing', () => {
  let provider: TestLLMProvider;

  beforeEach(() => {
    provider = new TestLLMProvider();
  });

  describe('validateTemplate()', () => {
    it('should return isValid: true for a valid template with known placeholders', () => {
      const result = provider.publicValidateTemplate('Hello {BRANCH_NAME}, this is the diff: {DIFF_CONTENT}');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return isValid: false for mismatched curly braces (unclosed)', () => {
      const result = provider.publicValidateTemplate('Hello {BRANCH_NAME, this is bad');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mismatched curly braces in template.');
    });

    it('should return isValid: false for mismatched curly braces (unopened)', () => {
      const result = provider.publicValidateTemplate('Hello BRANCH_NAME}, this is bad');
      // This specific case might not be caught by "Mismatched curly braces" if counts are equal due to other braces.
      // It should be caught by "Invalid placeholder format" if it doesn't match `{\w+}`.
      // If { and } counts are unequal, "Mismatched" is primary.
      // If counts are equal, but format is `WORD}` it might not be caught by current regexes.
      // Let's refine this test based on actual regex behavior.
      // The current regex `/{([^{}]+)}/g` and `^\w+$` check on content should catch this.
      const resultForInvalid = provider.publicValidateTemplate('Hello BRANCH_NAME}');
      expect(resultForInvalid.isValid).toBe(false);
      expect(resultForInvalid.errors).toContain('Mismatched curly braces in template.');


      const resultWithBalancedButWrong = provider.publicValidateTemplate('Hello {BRANCH_NAME} and also BRANCH_NAME}');
       expect(resultWithBalancedButWrong.isValid).toBe(false);
       expect(resultWithBalancedButWrong.errors).toContain('Mismatched curly braces in template.');

    });

    it('should return isValid: false for invalid placeholder syntax (spaces)', () => {
      const result = provider.publicValidateTemplate('Hello {BRANCH NAME}');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid placeholder format: {BRANCH NAME}. Placeholders should be e.g. {PLACEHOLDER_NAME} (no spaces, no nesting).');
    });

    it('should return isValid: false for invalid placeholder syntax (nested)', () => {
      const result = provider.publicValidateTemplate('Hello {{NESTED_PLACEHOLDER}}');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid placeholder format: {{NESTED_PLACEHOLDER}}. Placeholders should be e.g. {PLACEHOLDER_NAME} (no spaces, no nesting).');
    });

    it('should return isValid: false for unknown placeholders', () => {
      const result = provider.publicValidateTemplate('Hello {UNKNOWN_PLACEHOLDER}');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown placeholder: {UNKNOWN_PLACEHOLDER}.');
    });

    it('should return isValid: false for templates containing <script> tags', () => {
      const result = provider.publicValidateTemplate('Hello <script>alert("XSS")</script> {BRANCH_NAME}');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template contains script tags, which are not allowed.');
    });

    it('should return isValid: true for an empty template string', () => {
      const result = provider.publicValidateTemplate('');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return isValid: false for multiple errors', () => {
        const result = provider.publicValidateTemplate('Hello {UNKNOWN} <script>foo</script> {BAD SYNTAX}');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Template contains script tags, which are not allowed.');
        expect(result.errors).toContain('Invalid placeholder format: {BAD SYNTAX}. Placeholders should be e.g. {PLACEHOLDER_NAME} (no spaces, no nesting).');
        expect(result.errors).toContain('Unknown placeholder: {UNKNOWN}.');
    });
  });

  describe('processTemplate()', () => {
    it('should correctly substitute various placeholders', () => {
      const template = 'Branch: {BRANCH_NAME}, Title: {PULL_REQUEST_TITLE}, Diff: {DIFF_CONTENT}';
      const templateVars = {
        BRANCH_NAME: 'feature/test',
        PULL_REQUEST_TITLE: 'My Awesome PR',
        DIFF_CONTENT: 'This is a diff.',
      };
      const result = provider.publicProcessTemplate(template, templateVars);
      expect(result).toBe('Branch: feature/test, Title: My Awesome PR, Diff: This is a diff.');
    });

    it('should leave placeholders as is if not present in templateVars', () => {
      const template = 'Hello {BRANCH_NAME}, your message is {MESSAGE}';
      const templateVars = { BRANCH_NAME: 'dev' };
      const result = provider.publicProcessTemplate(template, templateVars);
      expect(result).toBe('Hello dev, your message is {MESSAGE}');
    });

    it('should handle undefined values in templateVars gracefully (leave placeholder as is)', () => {
      const template = 'Value: {MAYBE_UNDEFINED}';
      const templateVars = { MAYBE_UNDEFINED: undefined as unknown as string }; // Simulate undefined
      const result = provider.publicProcessTemplate(template, templateVars);
      expect(result).toBe('Value: {MAYBE_UNDEFINED}');
    });

    it('should handle empty templateVars', () => {
      const template = 'Hello {BRANCH_NAME}';
      const result = provider.publicProcessTemplate(template, {});
      expect(result).toBe('Hello {BRANCH_NAME}');
    });

    it('should handle an empty template string', () => {
      const result = provider.publicProcessTemplate('', { BRANCH_NAME: 'test' });
      expect(result).toBe('');
    });

    it('should correctly substitute DIFF_CONTENT placeholder', () => {
      const template = 'Diff: {DIFF_CONTENT}';
      const templateVars = { DIFF_CONTENT: 'Line1\nLine2' };
      const result = provider.publicProcessTemplate(template, templateVars);
      expect(result).toBe('Diff: Line1\nLine2');
    });
  });

  describe('generatePRDescription() in BaseLLMProvider', () => {
    let executeLLMSpy: jest.SpyInstance;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      executeLLMSpy = jest.spyOn(provider as any, 'executeLLMGeneration');
    });

    afterEach(() => {
      executeLLMSpy.mockRestore();
    });

    it('should call validateTemplate and throw error if template is invalid', async () => {
      const options: GenerateDescriptionOptions = {
        template: 'Hello {INVALID PLACEHOLDER}',
        templateData: { DIFF_CONTENT: 'diff' },
      };
      await expect(provider.generatePRDescription(options)).rejects.toThrow(LLMProviderError);
      await expect(provider.generatePRDescription(options)).rejects.toThrow(/Invalid template: Invalid placeholder format/);
    });

    it('should use default template if options.template is not provided', async () => {
      const defaultTemplate = provider.publicGetDefaultPromptTemplate();
      const templateData = { DIFF_CONTENT: 'diff content here' };
      executeLLMSpy.mockResolvedValueOnce({ description: 'mocked', model: 'm', provider: LLMProviderType.OPENAI });

      await provider.generatePRDescription({ templateData });

      expect(executeLLMSpy).toHaveBeenCalledWith(
        expect.stringContaining('diff content here'), // Check if DIFF_CONTENT was processed into default template
        expect.anything()
      );
      // Check that the processed prompt passed to executeLLMGeneration IS the processed default template
      const processedDefault = provider.publicProcessTemplate(defaultTemplate, templateData);
      expect(executeLLMSpy.mock.calls[0][0]).toBe(processedDefault);
    });

    it('should use custom template if options.template is provided and valid', async () => {
      const customTemplate = 'Custom: {DIFF_CONTENT} from {BRANCH_NAME}';
      const templateData = { DIFF_CONTENT: 'my diff', BRANCH_NAME: 'feat/custom' };
      const options: GenerateDescriptionOptions = { template: customTemplate, templateData };
      executeLLMSpy.mockResolvedValueOnce({ description: 'mocked', model: 'm', provider: LLMProviderType.OPENAI });

      await provider.generatePRDescription(options);

      const processedCustom = provider.publicProcessTemplate(customTemplate, templateData);
      expect(executeLLMSpy).toHaveBeenCalledWith(processedCustom, options);
    });

    it('should correctly extract DIFF_CONTENT from templateData and pass to processTemplate', async () => {
      const template = 'Content: {DIFF_CONTENT}';
      const templateData = { DIFF_CONTENT: 'actual diff' };
      const options: GenerateDescriptionOptions = { template, templateData };
      executeLLMSpy.mockResolvedValueOnce({ description: 'mocked', model: 'm', provider: LLMProviderType.OPENAI });

      await provider.generatePRDescription(options);

      const processed = provider.publicProcessTemplate(template, templateData);
      expect(executeLLMSpy).toHaveBeenCalledWith(processed, options);
    });

    it('should truncate DIFF_CONTENT if diffSizeLimit is exceeded', async () => {
      const longDiff = 'a'.repeat(100);
      const diffSizeLimit = 50;
      const templateData = { DIFF_CONTENT: longDiff };
      const options: GenerateDescriptionOptions = {
        template: '{DIFF_CONTENT}',
        templateData,
        diffSizeLimit,
      };
      executeLLMSpy.mockResolvedValueOnce({ description: 'mocked', model: 'm', provider: LLMProviderType.OPENAI });

      const response = await provider.generatePRDescription(options);

      const expectedTruncatedDiff = longDiff.substring(0, diffSizeLimit) + '\n\n[... diff truncated due to size limit ...]';
      expect(response.originalDiffSize).toBe(100);
      expect(response.truncatedDiffSize).toBe(expectedTruncatedDiff.length);
      expect(response.diffSizeTruncated).toBe(true);

      const processedTemplateWithTruncatedDiff = provider.publicProcessTemplate(
        '{DIFF_CONTENT}',
        { DIFF_CONTENT: expectedTruncatedDiff }
      );
      expect(executeLLMSpy).toHaveBeenCalledWith(processedTemplateWithTruncatedDiff, options);
    });

    it('should handle missing DIFF_CONTENT in templateData gracefully (passed as empty string to processTemplate)', async () => {
      const template = 'Content: {DIFF_CONTENT}';
      // DIFF_CONTENT is missing in templateData
      const templateData = { BRANCH_NAME: 'feat/test' };
      const options: GenerateDescriptionOptions = { template, templateData };
      executeLLMSpy.mockResolvedValueOnce({ description: 'mocked', model: 'm', provider: LLMProviderType.OPENAI });

      await provider.generatePRDescription(options);

      // processTemplate will receive DIFF_CONTENT: ''
      const processed = provider.publicProcessTemplate(template, { ...templateData, DIFF_CONTENT: '' });
      expect(executeLLMSpy).toHaveBeenCalledWith(processed, options);
    });

     it('should call processTemplate with all templateData', async () => {
      const template = 'Branch: {BRANCH_NAME}, Title: {PULL_REQUEST_TITLE}, Diff: {DIFF_CONTENT}';
      const templateData = {
        BRANCH_NAME: 'feature/test',
        PULL_REQUEST_TITLE: 'My PR',
        DIFF_CONTENT: 'diff details',
        ADDITIONAL_DATA: 'some other info' // This won't be in the template, but should be in templateData
      };
      const options: GenerateDescriptionOptions = { template, templateData };
      executeLLMSpy.mockResolvedValueOnce({ description: 'mocked', model: 'm', provider: LLMProviderType.OPENAI });

      const processSpy = jest.spyOn(provider as any, 'processTemplate');
      await provider.generatePRDescription(options);

      expect(processSpy).toHaveBeenCalledWith(template, templateData); // DIFF_CONTENT is already part of templateData
      processSpy.mockRestore();
    });
  });
});
