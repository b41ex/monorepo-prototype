const path = require('path');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/web-components/index.ts',
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    // Some bundled modules call require('buffer') and expect Node's builtin. None of them declares
    // the npm package, so without this alias webpack resolves it through pnpm's hidden hoist,
    // node_modules/.pnpm/node_modules/buffer, and the version there changes with unrelated lockfile
    // edits. The alias takes the buffer this package declares.
    alias: {
      buffer$: require.resolve('buffer/'),
    },
    plugins: [new TsconfigPathsPlugin()],
    fallback: {
      stream: false,
      path: false,
      process: require.resolve('process/browser'),
      // httpsnippet 1.25.0 does require('querystring'), and webpack 5 does not polyfill
      // Node builtins. The build worked without this entry only because the querystring
      // npm shim arrived transitively and was flat-hoisted where webpack could see it;
      // under a workspace or an isolated linker it is not there and the build fails with
      // "Can't resolve 'querystring' in .../httpsnippet/src". Declared in package.json
      // and named here, so it no longer depends on what happens to be hoisted.
      //
      // The subpath is deliberate: 'querystring' alone resolves to Node's builtin and
      // hands webpack back the same name it could not resolve. 'process/browser' above
      // is the same trick.
      querystring: require.resolve('querystring/index.js'),
    },
  },
  performance: {
    maxEntrypointSize: 2000000,
    maxAssetSize: 2000000,
  },
  output: {
    filename: 'index.js',
    path: path.join(process.cwd(), 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.mjs$/,
        include: /node_modules/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser'),
    }),
  ],
};
