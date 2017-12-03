/*global require, console, Promise*/
var util = require('util');
var google = require('googleapis');
var retry = require('retry');
var fs = require("fs");

function gsuiteDriveManager(mainSpecs) {
    "use strict";
    var auth;
    var service = google.drive('v3');

    function getOperation() {
        return retry.operation({
            retries: 5,
            factor: 3,
            minTimeout: 1 * 1000,
            maxTimeout: 60 * 1000,
            randomize: true
        });
    }

    function about() {
        return new Promise(function (resolve, reject) {
            var request = {
                auth: auth,
                fields: "user(permissionId,emailAddress,me)"
            };
            var operation = getOperation();

            operation.attempt(function () {
                service.about.get(request, function (err, response) {
                    if (operation.retry(err)) {
                        console.warn("Warning, about() error %s occured, retry %d", err.code, operation.attempts());
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

    function getFile(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var request = {
                auth: auth,
                fileId: fileId
            };
            var operation = getOperation();

            if (specs.fields) {
                request.fields = specs.fields;
            }

            operation.attempt(function () {
                service.files.get(request, function (err, response) {
                    if (operation.retry(err)) {
                        console.log("Warning, getFile() error %s occured, retry %d", err.code, operation.attempts());
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

    function getRootfolderId() {
        return getFile({
            fileId: "root"
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
                var operation = getOperation();
                if (pageToken) {
                    request.pageToken = pageToken;
                }

                operation.attempt(function () {
                    service.files.list(request, function (err, response) {
                        if (operation.retry(err)) {
                            console.log("Warning, getFiles() error %s occured, retry %d", err.code, operation.attempts());
                            return;
                        }
                        if (err) {
                            reject(operation.mainError());
                            return;
                        }
                        var files = response.files;
                        files.forEach(function (file) {
                            fileSet.push(file);
                        });

                        if (files.length === 0 && !response.nextPageToken) {
                            resolve(fileSet);
                            return;
                        }
                        if (!response.nextPageToken) {
                            resolve(fileSet);
                            return;
                        }
                        listFiles(response.nextPageToken);
                    });
                });
            }
            listFiles();
        });
    }

    function deleteParents(specs) {
        return new Promise(function (resolve, reject) {
            var fileId = specs.fileId;
            var removeParents = specs.removeParents;
            var request = {
                auth: auth,
                fileId: fileId,
                removeParents: removeParents.join(",")
            };

            var operation = getOperation();

            if (specs.fields) {
                request.fields = specs.fields;
            }
            operation.attempt(function () {
                service.files.update(request, function (err, response) {
                    if (operation.retry(err)) {
                        console.log("Warning, deleteParents() error %s occured, retry %d", err.code, operation.attempts());
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
                var dest = fs.createWriteStream(path);
                service.files
                    .get(request, function (errortje) {
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
        });
    }



    function getRootFiles(specs) {
        specs.q = util.format("\"%s\" in owners and \"root\" in parents", specs.primaryEmail);
        return getFiles(specs);
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

            if (specs.removeParents) {
                request.removeParents = specs.removeParents.join(",");
            }

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
            var transferOwnership = false;
            var sendNotificationEmail = false;
            var role = specs.role;
            var emailAddress = specs.emailAddress;
            var type = specs.type;

            if (specs.transferOwnership === true) {
                transferOwnership = true;
            }

            if (specs.sendNotificationEmail === true) {
                sendNotificationEmail = true;
            }

            var request = {
                auth: auth,
                fileId: fileId,
                transferOwnership: transferOwnership,
                sendNotificationEmail: sendNotificationEmail,
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

    function deleteFile(specs) {
        return new Promise(function (resolve, reject) {
            var request = {
                auth: auth,
                fileId: specs.fileId
            };

            if (specs.fields) {
                request.fields = specs.fields;
            }

            var operation = getOperation();

            operation.attempt(function () {
                service.files.delete(request, function (err, response) {
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
        getFile: getFile,
        getRootfolderId: getRootfolderId,
        getRootFiles: getRootFiles,
        copy: copy,
        getPermissions: getPermissions,
        updatePermission: updatePermission,
        addPermission: addPermission,
        createFile: createFile,
        addParents: addParents,
        deleteParents: deleteParents,
        deletePermission: deletePermission,
        deleteFile: deleteFile,
        about: about,
        update: update,
        download: download,
        setProperties: setProperties
    };
}
module.exports = gsuiteDriveManager;