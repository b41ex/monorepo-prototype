'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/

module.exports = () => {
    return {
        target: 'webworker',

        entry: './src/extension.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode',
            fs: 'commonjs fs',
            path: 'commonjs path'
        },
        resolve: {
            mainFields: ['browser', 'module', 'main'],
            extensions: ['.ts', '.js'],
            alias: {},
            fallback: {}
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader'
                        }
                    ]
                }
            ]
        },
        plugins: [
            // Resolve the copied assets through Node rather than by the literal path
            // node_modules/<pkg>/... . That path is only correct while these packages sit
            // inside this directory: it is wrong under a workspace, under pnpm's isolated
            // linker, and under any install that dedupes them to a parent. Neither package
            // declares an "exports" map, so the deep subpaths resolve directly; if either
            // ever adds one, this fails loudly at config load instead of copying the wrong
            // file or nothing.
            new CopyPlugin({
                patterns: [
                    {
                        from: require.resolve('@vscode-elements/elements/dist/bundled.js'),
                        to: path.resolve(__dirname, 'dist/bundled.js')
                    },
                    {
                        from: require.resolve('@vscode/codicons/dist/codicon.css'),
                        to: path.resolve(__dirname, 'dist/codicon.css')
                    },
                    {
                        from: require.resolve('@vscode/codicons/dist/codicon.ttf'),
                        to: path.resolve(__dirname, 'dist/codicon.ttf')
                    }
                ]
            })
        ]
    };
};
