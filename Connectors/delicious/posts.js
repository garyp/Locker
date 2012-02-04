/*
 *
 * Copyright (C) 2012, The Locker Project
 * All rights reserved.
 *
 * Please see the LICENSE file for more information.
 *
 */

var async = require('async')
  , request = require('request')
  , url = require('url')
  , util = require('util')
  , xml2js = require('xml2js');

function api(method, params, auth, cb) {
    // TODO: send a user-agent header
    request.get(url.format({ protocol: 'https:'
                           , hostname: 'api.del.icio.us'
                           , pathname: '/v1/' + method
                           , auth: auth.user + ':' + auth.password
                           , query: params })
              , cb);
}

function transformPosts(emit_fn, posts, callback) {
    if (!posts || !('post' in posts) || !posts.post.length) {
        return callback("no posts");
    }
    async.forEach(posts.post
                , function(post, cb) {
                      if (!('@' in post)) {
                          return cb("malformed post: " + util.inspect(post));
                      }
                      post = post['@'];
                      // time gets returned as an ISO8601 string
                      post.time = new Date(post.time);
                      // tag is a space-separated list of tags
                      post.tag = post.tag.trim();
                      post.tag = (post.tag ? post.tag.split(' ') : []);
                      emit_fn(post);
                      cb();
                  }
                , callback
    );
}

exports.sync = function (processInfo, cb) {
    var posts = [];

    async.waterfall([ async.apply(api, 'posts/all', {meta:'yes'}, processInfo.auth)
                    , function(res, body, cb) {
                          // TODO: check res.statusCode
                          var parser = new xml2js.Parser({ explicitArray: true });
                          parser.parseString(body, cb);
                      }
                    , async.apply(transformPosts, function(post) {
                          posts.push(post);
                      })
                    ]
                  , function(err) {
                        if (err) {
                            console.error(err);
                            cb(err);
                        } else {
                            cb(null, { config: {}, data: { post: posts } });
                        }
                    }
    );
};
