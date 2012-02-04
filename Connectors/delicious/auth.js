module.exports = {
    handler : function (host, auth, done, req, res) {
        if (!('user' in auth) || !('password' in auth)) {
            done("'user' and 'password' not in apikeys");
        }
        done(null, auth);
    }
};
