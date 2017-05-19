/*global require, console, Promise*/
/*jslint node: true */
var google = require('googleapis');
var retry = require('retry');
var fs = require("fs");

function gsuiteDriveManager(mainSpecs) {
    "use strict";
    var auth;
    var service = google.drive('v3');

    function about() {
        return new Promise(function (resolve, reject) {
            var request = {
                auth: auth,
                fields: "user(permissionId)"
            };

            service.about.get(request, function (err, response) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(response);
            });
        });
    }

    function download(specs) {

        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var path = specs.path;
            var request = {
                auth: auth,
                fileId: fileId,
                alt: 'media'
            };

            var operation = retry.operation({
                retries: 6,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {
                //                throw new Error();
                var dest = fs.createWriteStream(path);
                service.files.get(request, function (errortje) {
                    if (operation.retry(errortje)) {
                        console.log("Warning, error %s occured, retry %d, %s, file: %s", errortje.code, operation.attempts(), errortje.message, path);
                    }
                })
                    .on('error', function (err) {

                        if (operation.retry(err)) {
                            console.log("Warning On Error, error %s occured, retry %d, %s", err.code, operation.attempts(), err.message);
                            return;
                        }

                        if (err) {
                            console.log('Error during download', err);
                            reject(err);
                        }

                    })
                    .pipe(dest)
                    .on('finish', function (response) {
                        console.log('Saved %s', path);
                        resolve(response);
                    })
                    .on('error', function (err) {

                        if (operation.retry(err)) {
                            console.log("Pipe Warning On Error, error %s occured, retry %d, %s", err.code, operation.attempts(), err.message);
                            return;
                        }

                        if (err) {
                            console.log('Pipe Error during download', err);
                            reject(err);
                        }

                    });
            });
        });

    }

    function getFiles(specs) {

        return new Promise(function (resolve, reject) {
            var fileSet = [];
            var request = {
                auth: auth,
                pageSize: 500
            };

            if (specs.q) {
                request.q = specs.q;
            }

            if (specs.fields) {
                request.fields = specs.fields;
            }

            function listFiles(pageToken) {
                if (pageToken) {
                    request.pageToken = pageToken;
                }
                var operation = retry.operation({
                    retries: 5,
                    factor: 3,
                    minTimeout: 1 * 1000,
                    maxTimeout: 60 * 1000,
                    randomize: true
                });

                operation.attempt(function () {
                    service.files.list(request, function (err, response) {
                        if (operation.retry(err)) {
                            console.log("Error " + err.code + " retrieving files, retry " + operation.attempts());
                            //console.log(err.code);
                            // reject(err);
                            return;
                        }
                        if (err) {
                            reject('The API returned an error: ' + err);
                            return;
                        }
                        var files = response.files;
                        files.forEach(function (file) {
                            fileSet.push(file);
                            if (fileSet.length % 1000 === 0) {
                                console.log("working:fetched %d files for %s", fileSet.length, specs.user);
                            }
                        });

                        if (files.length === 0 && !response.nextPageToken) {
                            console.log("done:fetched %d files for %s", fileSet.length, specs.user);
                            resolve(fileSet);
                            return;
                        }
                        if (!response.nextPageToken) {
                            resolve(fileSet);
                            console.log("done:fetched %d files for %s", fileSet.length, specs.user);

                            return;
                        }
                        listFiles(response.nextPageToken);
                    });
                });
            }
            listFiles();
        });
    }

    function createFile(specs) {
        return new Promise(function (resolve, reject) {
            var name = specs.name;
            var mimeType = specs.mimeType;
            var parents = specs.parents;
            var request = {
                auth: auth,
                resource: {
                    name: name,
                    mimeType: mimeType,
                    parents: parents
                }
            };

            if (specs.fields) {
                request.fields = specs.fields;
            }

            var operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {
                service.files.create(request, function (err, response) {
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d", err.code, operation.attempts());
                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });
        });
    }

    function copy(specs) {

        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var request = {
                auth: auth,
                fileId: fileId,
                resource: {}
            };

            if (specs.fields) {
                request.fields = specs.fields;
            }

            if (specs.name) {
                request.resource.name = specs.name;
            }

            if (specs.parents) {
                request.resource.parents = specs.parents;
            }


            var operation = retry.operation({
                retries: 6,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {
                service.files.copy(request, function (err, response) {
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d", err.code, operation.attempts());
                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });

            // service.files.copy(request, function (err, response) {
            //     if (err) {
            //         reject(err);
            //         return;
            //     }
            //     resolve(response);
            // });
        });
    }

    function addParents(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var newParents = specs.newParents;
            var request = {
                auth: auth,
                fileId: fileId,
                addParents: newParents.join(",")
            };

            if (specs.fields) {
                request.fields = specs.fields;
            }

            service.files.update(request, function (err, response) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(response);
            });
        });
    }

    function getPermissions(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var request = {
                auth: auth,
                fileId: fileId
            };

            if (specs.fields) {
                request.fields = specs.fields;
            }
            var operation = retry.operation({
                retries: 6,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {

                service.permissions.list(request, function (err, response) {
                    if (err && err.code === 403) {
                        if (err.message === "The user does not have sufficient permissions for this file.") {
                            console.log("Error, error %s occured, retry %d", err.code, operation.attempts());
                            reject(err);
                            return;
                        }
                    }
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d", err.code, operation.attempts());
                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });
        });
    }

    function addPermission(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var transferOwnership = specs.transferOwnership;
            var role = specs.role;
            var emailAddress = specs.emailAddress;
            var type = specs.type;
            var request = {
                auth: auth,
                fileId: fileId,
                // permissionId: permissionId,
                transferOwnership: transferOwnership,
                // sendNotificationEmail: false,
                resource: {
                    role: role,
                    emailAddress: emailAddress,
                    type: type
                }
            };

            if (specs.fields) {
                request.fields = specs.fields;
            }

            var operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });
            operation.attempt(function () {
                service.permissions.create(request, function (err, response) {
                    if (err && err.code === 403) {
                        if (err.message === "The user does not have sufficient permissions for this file.") {
                            console.log("Error, error %s occured, retry %d %s", err.code, operation.attempts());
                            reject(err);
                            return;
                        }
                    }
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d, %s", err.code, operation.attempts(), err.message);

                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });
        });
    }


    function updatePermission(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var permissionId = specs.permissionId;
            var transferOwnership = specs.transferOwnership;
            var role = specs.role;
            var request = {
                auth: auth,
                fileId: fileId,
                permissionId: permissionId,
                transferOwnership: transferOwnership,
                resource: {
                    role: role
                }
            };

            if (specs.fields) {
                request.fields = specs.fields;
            }

            if (permissionId === undefined) {
                reject("missing a permission id");
                return;
            }

            var operation = retry.operation({
                retries: 6,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {
                service.permissions.update(request, function (err, response) {
                    if (err && err.code === 403) {
                        if (err.message === "The user does not have sufficient permissions for this file.") {
                            console.log("Error, error %s occured, retry %d", err.code, operation.attempts());
                            reject(err);
                            return;
                        }
                    }
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d", err.code, operation.attempts());
                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });

        });
    }

    function update(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var request = {
                auth: auth,
                fileId: fileId,
                resource: specs.resource
            };

            var operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {
                service.files.update(request, function (err, response) {
                    if (err && err.code === 403) {
                        if (err.message === "The user does not have sufficient permissions for this file.") {
                            console.log("Error, error %s occured, retry %d", err.code, operation.attempts());
                            reject(err);
                            return;
                        }
                    }
                    if (err && err.code === 404) {
                        resolve();
                        return;
                    }
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d, %s", err.code, operation.attempts(), err.message);
                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });

        });



    }

    function deletePermission(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var permissionId = specs.permissionId;
            var request = {
                auth: auth,
                fileId: fileId,
                permissionId: permissionId
            };

            if (permissionId === undefined) {
                reject("missing a permission id");
                return;
            }

            var operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {
                service.permissions.delete(request, function (err, response) {
                    if (err && err.code === 403) {
                        if (err.message === "The user does not have sufficient permissions for this file.") {
                            console.log("Error, error %s occured, retry %d", err.code, operation.attempts());
                            reject(err);
                            return;
                        }
                    }
                    if (err && err.code === 404) {
                        resolve();
                        return;
                    }
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d, %s", err.code, operation.attempts(), err.message);
                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });

        });



    }

    function setProperties(specs) {
        // console.log("setProperties " + JSON.stringify(specs));
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var properties = JSON.parse(specs.properties);
            var request = {
                auth: auth,
                fileId: fileId,
                resource: {
                    properties: properties
                },
                fields: "id,parents,properties"
            };

            var operation = retry.operation({
                retries: 6,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true
            });

            operation.attempt(function () {
                service.files.update(request, function (err, response) {
                    //  console.log("setProperties");
                    if (operation.retry(err)) {
                        console.log("Warning, error %s occured, retry %d, %s setProperties", err.code, operation.attempts(), err.message);
                        return;
                    }
                    if (err) {
                        reject(operation.mainError());
                        return;
                    }
                    resolve(response);
                });
            });
        });
    }

    auth = mainSpecs.auth;
    return {
        getFiles: getFiles,
        copy: copy,
        getPermissions: getPermissions,
        updatePermission: updatePermission,
        addPermission: addPermission,
        createFile: createFile,
        addParents: addParents,
        deletePermission: deletePermission,
        about: about,
        update: update,
        download: download,
        setProperties: setProperties
    };
}

module.exports = gsuiteDriveManager;