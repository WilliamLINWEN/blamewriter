const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      popup: './src/popup/popup.ts',
      background: './src/background/background.ts',
      content: './src/content/content.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json',
          },
          {
            from: 'src/popup/popup.html',
            to: 'popup.html',
          },
          {
            from: 'src/popup/popup.css',
            to: 'popup.css',
          },
          {
            from: 'src/icons/',
            to: 'icons/',
          },
          {
            from: 'src/options/',
            to: 'options/',
          },
        ],
      }),
    ],
    devtool: isProduction ? false : 'source-map',
    mode: argv.mode || 'development',
  };
};
