// webpack.config.js
const webpack = require('webpack');
module.exports = {
    entry: './src/index.js',
    mode: 'production',
    output: {
        filename: 'icp.umd.js',
        library: 'AICPWallet',
        libraryTarget: 'umd',
        libraryExport: 'default',
        umdNamedDefine: true
    },
    // externals: {
    //     xmlhttprequest: {
    //         commonjs2: 'xmlhttprequest',
    //         commonjs: 'xmlhttprequest',
    //         umd: 'xmlhttprequest',
    //         root: 'xmlhttprequest'
    //     },
    //     'xhr2-cookies': {
    //         commonjs2: 'xmlhttprequest',
    //         commonjs: 'xmlhttprequest',
    //         umd: 'xmlhttprequest',
    //         root: 'xmlhttprequest'
    //     }
    // },
    // resolve.fallback: { "stream": false },
    resolve: {
        alias: {},
        modules: [
            './src',
            './node_modules'
        ],
        fallback: {
            "stream": require.resolve("stream-browserify")
        },
        extensions: ['.js', '.jsx', '.less', '.css', '.json']

    },
    target: 'web',
    optimization: {
        removeEmptyChunks: true,
        sideEffects: true,
        minimize: true
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^\.\/wordlists\/(?!english)/,
            contextRegExp: /bip39\/src$/
        }),
        new webpack.DefinePlugin({
            'process.env.RUNTIME_ENV': JSON.stringify(process.env.RUNTIME_ENV || 'browser')
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],

        })
    ]
};