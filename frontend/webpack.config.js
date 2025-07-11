const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      popup: './src/popup/popup.ts',
      background: './src/background/background.ts',
      content: './src/content/content.ts',
      'options/options': './src/options/options.ts',
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
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
      }),
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
            globOptions: {
              ignore: ['**/*.ts'],
            },
          },
          {
            from: 'src/content/content.css',
            to: 'content.css',
          },
        ],
      }),
    ],
    devtool: isProduction ? false : 'source-map',
    mode: argv.mode || 'development',
  };
};
