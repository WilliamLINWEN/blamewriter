# User Guide - Bitbucket PR Description Generator (MVP)

## 🌟 Welcome

Welcome to the Bitbucket PR Description Generator! This browser extension uses AI to automatically generate high-quality, structured descriptions for your Bitbucket Pull Requests, saving you time and improving PR documentation quality.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [Setup](#setup)
4. [Using the Extension](#using-the-extension)
5. [Features](#features)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)
8. [Support](#support)

## 🚀 Getting Started

### What You Need

Before using the extension, make sure you have:

- **Chrome Browser** (latest version recommended)
- **Bitbucket Account** with access to repositories
- **Bitbucket Access Token** (we'll help you create this)
- **OpenAI API Key** (for AI-powered description generation)

### How It Works

1. **Navigate** to any Bitbucket Pull Request page
2. **Click** the extension icon in your browser toolbar
3. **Enter** your Bitbucket token and OpenAI API key (one-time setup)
4. **Click** "Generate Description" button
5. **Review** and use the AI-generated PR description

## 📦 Installation

### Step 1: Get the Extension

Since this is currently in MVP phase, you'll need to install it manually:

1. **Download** the extension files from the development team
2. **Extract** the files to a folder on your computer
3. **Remember** the location of the `dist` folder

### Step 2: Load in Chrome

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer Mode** (toggle in the top-right corner)
3. **Click "Load unpacked"** button
4. **Select** the `dist` folder from the extracted files
5. **Confirm** the extension appears in your extensions list

### Step 3: Verify Installation

- Look for the **🤖 extension icon** in your Chrome toolbar
- The icon should be visible and clickable
- If you don't see it, check the extensions menu (puzzle piece icon)

## ⚙️ Setup

### Getting Your Bitbucket Access Token

1. **Log in** to Bitbucket
2. **Click** your profile picture → **Personal settings**
3. **Navigate** to **App passwords** (under "Access management")
4. **Click "Create app password"**
5. **Configure permissions**:
   - **Label**: "PR Description Generator"
   - **Permissions**: Check "Repositories: Read"
6. **Copy** the generated token (save it securely!)

### Getting Your OpenAI API Key

1. **Visit** [OpenAI Platform](https://platform.openai.com/)
2. **Sign up** or **log in** to your account
3. **Navigate** to **API keys** section
4. **Click "Create new secret key"**
5. **Copy** the API key (save it securely!)
6. **Note**: You'll need to add billing information to use the API

### First-Time Configuration

1. **Navigate** to any Bitbucket PR page
2. **Click** the extension icon in your toolbar
3. **Enter** your Bitbucket access token
4. **Enter** your OpenAI API key  
5. **Select** your preferred AI model (GPT-4 recommended)
6. **Click "Save Settings"**

Your credentials are stored locally and will be remembered for future uses.

## 🎯 Using the Extension

### Basic Usage

#### Method 1: Using the Popup Interface

1. **Open** any Bitbucket Pull Request page
2. **Click** the extension icon in your browser toolbar
3. **Review** the detected PR information
4. **Adjust** settings if needed (model, template, etc.)
5. **Click "Generate Description"**
6. **Wait** for the AI to analyze the PR and generate content
7. **Review** the generated description
8. **Copy** the description to your PR

#### Method 2: Using the Inject Button (if available)

1. **Open** any Bitbucket Pull Request page
2. **Look** for the "✨ AI Generate Description" button near the description area
3. **Click** the button to trigger generation
4. **Wait** for the generated content to appear

### Understanding the Generation Process

When you click "Generate Description", the extension:

1. **Extracts** PR information from the current page
2. **Fetches** the PR diff (code changes) from Bitbucket
3. **Analyzes** the changes using AI
4. **Generates** a structured description
5. **Returns** the formatted result

This process typically takes 10-30 seconds depending on PR size.

### Generated Description Format

The AI generates descriptions with the following structure:

```markdown
## Summary
Brief overview of the changes

## Changes
- Detailed list of modifications
- New features added
- Bug fixes implemented

## Files Modified
- List of changed files with brief descriptions

## Impact
- Potential impact on the system
- Areas that might be affected

## Testing
- Suggested testing approaches
- Areas to focus testing on
```

## ✨ Features

### MVP Features (Current Version)

- **✅ Manual Token Input**: Secure local storage of your Bitbucket tokens
- **✅ OpenAI Integration**: Powered by GPT models for high-quality descriptions
- **✅ PR Detection**: Automatically detects Bitbucket PR pages
- **✅ Diff Analysis**: Analyzes code changes to generate relevant descriptions
- **✅ Clean UI**: Simple, intuitive popup interface
- **✅ Error Handling**: Clear error messages and troubleshooting guidance

### Model Options

- **GPT-4**: Best quality, slower, more expensive
- **GPT-3.5-turbo**: Good balance of speed and quality
- **GPT-4-turbo**: Fast and high quality (when available)

### Supported File Types

The extension can analyze various file types:
- **Code files**: .js, .ts, .py, .java, .cpp, .cs, etc.
- **Web files**: .html, .css, .scss, .vue, .jsx, .tsx
- **Config files**: .json, .yaml, .xml, .env
- **Documentation**: .md, .txt, .rst

## 🔧 Troubleshooting

### Common Issues

#### Extension Not Loading
**Symptom**: Extension icon not visible or not working

**Solutions**:
1. Check that Developer Mode is enabled in `chrome://extensions/`
2. Verify the extension is enabled in the extensions list
3. Try reloading the extension (click the refresh icon)
4. Restart Chrome browser

#### "Invalid Token" Error
**Symptom**: Error message about invalid or expired token

**Solutions**:
1. Verify your Bitbucket token is correct
2. Check that token has "Repositories: Read" permission
3. Ensure token hasn't expired
4. Generate a new token if needed

#### "PR Not Found" Error
**Symptom**: Error saying PR cannot be found or accessed

**Solutions**:
1. Verify you have access to the repository
2. Check that the PR URL is valid
3. Ensure you're on an actual PR page (not PR list)
4. Try refreshing the page

#### Generation Takes Too Long
**Symptom**: Description generation seems stuck or takes >2 minutes

**Solutions**:
1. Check your internet connection
2. Verify OpenAI API key is valid and has credits
3. Try a smaller PR with fewer changes
4. Refresh the page and try again

#### API Rate Limits
**Symptom**: Error about too many requests

**Solutions**:
1. Wait a few minutes before trying again
2. Check OpenAI usage limits on your account
3. Consider upgrading your OpenAI plan if needed

### Error Messages Explained

| Error Message | Meaning | Solution |
|---------------|---------|----------|
| "Invalid PR URL" | The current page is not a valid Bitbucket PR | Navigate to a PR page |
| "Invalid Token" | Bitbucket token is wrong or expired | Check and update your token |
| "API Rate Limit" | Too many requests to APIs | Wait before trying again |
| "LLM Error" | Problem with AI service | Check API key and try again |
| "Network Error" | Connection issues | Check internet connection |

### Debug Mode

To enable debug mode for troubleshooting:

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for extension-related messages
4. Share these logs with support if needed

## ❓ FAQ

### General Questions

**Q: Is my data secure?**
A: Yes! Your tokens are stored locally in your browser and only used for API requests. We don't store or transmit your credentials to our servers.

**Q: How much does it cost to use?**
A: The extension is free, but you need an OpenAI API account which has usage-based pricing. Typical PR generation costs $0.01-0.10 depending on PR size.

**Q: Can I use it with private repositories?**
A: Yes! As long as your Bitbucket token has access to the repository, it will work with private repos.

**Q: Does it work with Bitbucket Server/Data Center?**
A: Currently, only Bitbucket Cloud is supported. Bitbucket Server support may be added in future versions.

### Technical Questions

**Q: Which AI models are supported?**
A: Currently OpenAI models (GPT-4, GPT-3.5-turbo, GPT-4-turbo). More providers will be added in future versions.

**Q: Can I customize the description template?**
A: Template customization is planned for future versions. Currently, we use a standard format optimized for most PR types.

**Q: How large PRs can it handle?**
A: The extension can handle most PR sizes, but very large PRs (>1000 files or >50MB diff) may hit API limits or take longer to process.

**Q: Does it support multiple languages?**
A: Yes! The AI can analyze code in most programming languages and generate descriptions in English.

### Troubleshooting FAQs

**Q: Why is the extension not working on some Bitbucket pages?**
A: The extension only activates on Pull Request pages. Make sure you're viewing an individual PR, not a PR list or other Bitbucket page.

**Q: Can I use multiple Bitbucket accounts?**
A: Currently, you need to manually switch tokens. Multi-account support is planned for future versions.

**Q: What if I want to modify the generated description?**
A: The generated description is provided as text that you can copy, edit, and paste into your PR. Feel free to modify it as needed!

## 🆘 Support

### Getting Help

If you encounter issues or have questions:

1. **Check this guide** first for common solutions
2. **Review the troubleshooting section** above
3. **Check browser console** for error messages (F12 → Console)
4. **Contact support** with specific details about your issue

### Reporting Bugs

When reporting bugs, please include:

- **Chrome version** (Help → About Google Chrome)
- **Extension version** (visible in chrome://extensions/)
- **Steps to reproduce** the issue
- **Error messages** from browser console (if any)
- **Screenshot** of the problem (if applicable)
- **PR URL** where issue occurred (if not sensitive)

### Feature Requests

We welcome feedback and feature requests! Common requests for future versions:

- OAuth authentication (no manual tokens)
- Multiple LLM providers (Anthropic, etc.)
- Custom description templates
- Bitbucket Server support
- GitHub support

### Contact Information

- **Email**: [support email if available]
- **GitHub Issues**: [repository link if available]
- **Documentation**: This guide and technical docs

## 🚀 What's Next

### Upcoming Features (Future Versions)

- **OAuth Integration**: No more manual token management
- **Multiple LLM Providers**: Choice of AI providers
- **Custom Templates**: Create your own description formats
- **Team Settings**: Shared configurations for teams
- **Advanced UI**: More sophisticated interface
- **Multi-Platform**: GitHub and GitLab support

### Staying Updated

Since this is an MVP version:
- Features and UI may change
- Keep an eye out for updates from the development team
- Feedback helps prioritize new features

---

## 🎉 Happy PR Writing!

Thank you for using the Bitbucket PR Description Generator! We hope this tool saves you time and helps you write better PR descriptions. Your feedback is valuable in making this tool even better.

Remember: Great PR descriptions lead to better code reviews and smoother development workflows. Let AI handle the busy work while you focus on building amazing software! 🚀

---

*User Guide Version 1.0 - Last updated: June 13, 2025*
