# Open Source Telegram ChatGPT Bot

Welcome to the Open Source Telegram ChatGPT Bot built with Node.js and TypeScript! This powerful bot is designed to provide speech-to-text and text-to-speech capabilities using state-of-the-art AI services. The bot utilizes OpenAI Whisper for Speech-to-Text, Microsoft TTS, and soon Elevenlabs TTS for Text-to-Speech, and OpenAI ChatGPT to provide intelligent and interactive conversations with your users.



https://user-images.githubusercontent.com/19570043/236638196-78ed990c-3699-4583-b2b9-64c46183eed3.mp4



## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features

- Speech-to-Text with OpenAI Whisper
- Text-to-Speech with Microsoft TTS
- Soon: Text-to-Speech with Elevenlabs TTS
- OpenAI ChatGPT for interactive conversations

## Getting Started

These instructions will guide you through setting up and running the Open Source Telegram ChatGPT Bot on your local machine for development and testing purposes.

### Prerequisites

- Node.js 14+
- A Telegram account
- API keys for OpenAI, Microsoft TTS, and Elevenlabs TTS (when available)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/codextde/telegram-chatgpt.git
```

2. Change to the project directory:
```
cd telegram-chatgpt
```
3. Install the required dependencies:
```
npm install
```
## Configuration
Create a .env file in the root folder of the project, and add the following environment variables:
```bash
TELEGRAM_TOKEN=
SPEECH_KEY=
SPEECH_REGION=
OPENAI_KEY=
```
Replace the placeholders with your respective API keys and bot token.
Usage
Start the development server:

```bash
npm run start
```

Start a conversation with your bot on Telegram, and enjoy the Speech-to-Text and Text-to-Speech capabilities!

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
MIT

