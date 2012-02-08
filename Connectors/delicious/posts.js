/*
 *
 * Copyright (C) 2012, The Locker Project
 * All rights reserved.
 *
 * Please see the LICENSE file for more information.
 *
 */

var async = require('async')
  , jsonpath = require('JSONPath').eval
  , lutil = require('lutil')
  , request = require('request')
  , url = require('url')
  , util = require('util')
  , xml2js = require('xml2js');

Object.prototype.setDefault = function(key, def_value) {
    if (!(key in this)) {
        this[key] = def_value;
    }
    return this[key];
}

exports.sync = function (processInfo, syncDoneCB) {
    var auth = processInfo.auth || {};
    var config = processInfo.config || {};
    var syncedThrough = jsonpath(config, "$.updateState.posts.syncedThrough")[0] || 0;
    var responseObj = {data : {}, config : {}};

    async.waterfall([ async.apply(getLastUpdated, auth)
                    , function(lastUpdated, cb) {
                          if (lastUpdated.getTime() <= syncedThrough) {
                              cb();
                          } else {
                              syncedThrough = lastUpdated.getTime();
                              getUpdatedPosts(auth, config.posts, cb);
                          }
                      }
                    , function(posts, seen, cb) {
                          responseObj.data.posts = posts;
                          responseObj.config.posts = seen;
                          responseObj.config.updateState = {
                              posts: { syncedThrough: syncedThrough }
                          };
                          cb();
                      }
                    ]
                  , function(err) {
                        syncDoneCB(err, responseObj);
                    }
    );
}

function getLastUpdated(auth, cb) {
    var lastUpdated;
    api('posts/update', null, auth, true, function(err, updateInfo) {
        if (err) {
            cb(err);
        } else {
            var time = jsonpath(updateInfo, "$.@.time")[0];
            if (!time) {
                cb("posts/update did not return last update time");
            } else {
                cb(null, new Date(time));
            }
        }
    });
}

function getUpdatedPosts(auth, seen, cb) {
    var posts = [];
    var newSeen = {};
    async.waterfall([ async.apply(api, 'posts/all', {hashes:1}, auth, true)
                    , function(metaInfo, cb) {
                          if (!(metaInfo.post
                                && metaInfo.post.hasOwnProperty('length'))) {
                              return cb("posts/all?hashes returned malformed "
                                        "info: " + util.inspect(metaInfo));
                          }
                          var toFetch = [];
                          metaInfo.post.forEach(function(post) {
                              post = post['@'];
                              newSeen[post.url] = post.meta;
                              if (!(post.url in seen)) {
                                  toFetch.push({ hash: post.url, type: 'new' });
                              } else if (post.meta != seen[post.url]) {
                                  toFetch.push({ hash: post.url, type: 'update' });
                              }
                          }
                          for (var hash in seen) {
                              if (!(hash in newSeen)) {
                                  posts.push({ type: 'delete'
                                             , timestamp: new Date(),
                                             , obj: { hash: hash }
                                             });
                              }
                          }
                          var q = async.queue(function(fetchBatch, cb) {
                              var hashes = fetchBatch.map(function(post) {
                                  return post.hash;
                              }).join('+');
                              api('posts/get', { meta: 'yes', hashes: hashes }
                                , auth, true
                                , function(err, results) {
                                      cb(err, results, fetchBatch);
                                  }
                              );
                          }, 5);
                          for (var i=0; i<toFetch.length; i+=10) {
                              q.push(toFetch.slice(i, i+10), function(err, fetchedPosts) {
                                  if (err) return cb(err);
                                  fetchedPosts.forEach(function(post) {
                                      posts.push({ type: 
                          }


    async.waterfall([ async.apply(api, 'posts/all', {meta:'yes'}, auth, true)
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

function transformPosts(emitFn, posts, callback) {
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
                      emitFn(post);
                      cb();
                  }
                , callback
    );
}

function api(method, params, auth, json, cb) {
    // TODO: send a user-agent header
    request.get(url.format({ protocol: 'https:'
                           , hostname: 'api.del.icio.us'
                           , pathname: '/v1/' + method
                           , auth: auth.user + ':' + auth.password
                           , query: params })
              , function(err, res, body) {
                    if (err) return cb(err);
                    // TODO: check res.statusCode
                    if (json) {
                        var parser = new xml2js.Parser({ explicitArray: true });
                        parser.parseString(body, cb);
                    } else {
                        cb(null, body);
                    }
                }
    );
}
