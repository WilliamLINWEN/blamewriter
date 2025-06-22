import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock Bitbucket API endpoints
  http.get(
    'https://api.bitbucket.org/2.0/repositories/:workspace/:repo_slug/pullrequests/:pull_request_id',
    () => {
      return HttpResponse.json({
        id: 123,
        title: 'Test PR',
        description: 'Test PR description',
        source: {
          branch: { name: 'feature/test' },
          commit: { hash: 'abc123' },
        },
        destination: {
          branch: { name: 'main' },
          commit: { hash: 'def456' },
        },
        author: {
          display_name: 'Test User',
          username: 'testuser',
        },
        created_on: '2024-01-01T00:00:00.000000+00:00',
        updated_on: '2024-01-01T01:00:00.000000+00:00',
      });
    },
  ),

  http.get(
    'https://api.bitbucket.org/2.0/repositories/:workspace/:repo_slug/pullrequests/:pull_request_id/diff',
    () => {
      return HttpResponse.text(`diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,3 +1,4 @@
 console.log('hello');
+console.log('world');
 
 module.exports = {};`);
    },
  ),

  // Mock OpenAI API
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 1699999999,
      model: 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Generated PR description based on the diff.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75,
      },
    });
  }),

  // Mock Anthropic API
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Generated PR description using Anthropic Claude.',
        },
      ],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 50,
        output_tokens: 25,
      },
    });
  }),

  // Mock Ollama API
  http.post('http://localhost:11434/api/generate', () => {
    return HttpResponse.json({
      model: 'llama2',
      created_at: '2024-01-01T00:00:00.000Z',
      response: 'Generated PR description using Ollama.',
      done: true,
    });
  }),

  http.get('http://localhost:11434/api/tags', () => {
    return HttpResponse.json({
      models: [{ name: 'llama2' }, { name: 'codellama' }, { name: 'mistral' }],
    });
  }),
];
