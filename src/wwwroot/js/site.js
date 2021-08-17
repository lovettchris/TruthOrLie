// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.

class User {
    ref = null;
    key = null;
    name = "";
    score = 0;
    vote = false;
    admin = false;

    constructor(ref, key, userObject) {
        this.ref = ref; // location of users list.
        this.key = key;
        this.pull(userObject);
    }

    pull(userObject) {
        this.name = userObject.name;
        this.score = userObject.score;
        this.vote = userObject.vote;
        this.admin = userObject.admin;
    }

    update(validationElement, completed) {
        var realThis = this;
        // update the name or score of this user.
        this.ref.child(this.key).set({ "name": this.name, "score": this.score, "vote": this.vote, "admin": this.admin }, (error) => {
            if (error) {
                // The write failed...
                if (validationElement) {
                    validationElement.text(error);
                }
            } else {
                // Data saved successfully!
                if (completed) {
                    completed(realThis)
                }
            }
        });
    }

    vote_truth(validationElement, completed) {
        console.log("Voting for truth");
        this.vote = true;
        this.update(validationElement, completed);
    }

    vote_lie(validationElement, completed) {
        console.log("Voting it's a lie!");
        this.vote = false;
        this.update(validationElement, completed);
    }
}

class Game {
    key = null;
    title = null;
    active = null; // user that is in the hot seat
    user = null; // current user.
    users = {}; // list of current users.
    users_changed = null;
    update_timeout = null;
    user_changed = null;
    active_changed = null;

    constructor(key, game) {
        this.key = key;
        this.title = game.title;
        this.active = game.active;

        // register for added/removed events
        var realThis = this;
        this.users = []
        var ref = firebase.database().ref().child("games/" + this.key + "/users");

        var realThis = this;
        ref.on('child_added', function (x) { realThis.on_user_added(x); });
        ref.on('child_changed', function (x) { realThis.on_user_changed(x); });
        ref.on('child_removed', function (x) { realThis.on_user_removed(x); });

        var ref = firebase.database().ref().child("games/" + this.key + "/active");
        ref.on('child_added', function (x) { realThis.on_active_added(x); });
        ref.on('child_changed', function (x) { realThis.on_active_changed(x); });
        ref.on('child_removed', function (x) { realThis.on_active_removed(x); });


        var ref = firebase.database().ref().child("games/" + this.key + "/active");
        ref.get().then(function (data) {
            var active = data.val();
            if (active) {
                realThis.active = active.user;
                realThis.fire_active_changed();
            }
        });
    }

    leave() {
        // unregister!
        var ref = firebase.database().ref().child("games/" + this.key + "/users");
        ref.off();
        var ref = firebase.database().ref().child("games/" + this.key + "/active");
        ref.off();
        this.deactivate_user(null);
    }

    rename_user(name, validationElement, completed) {
        if (name.trim() == "") {
            return;
        }
        var realThis = this;
        validationElement.text("");
        var ref = firebase.database().ref().child("games/" + this.key + "/users");
        if (this.user == null) {
            // see if this user is already registered...
            var count = 0;
            for (key in this.users) {
                count++;
                var u = this.users[key];
                if (u.name == name) {
                    this.user = u;
                    if (this.user_changed) {
                        this.user_changed(u);
                    }
                    if (completed) {
                        completed(u);
                    }
                    return;
                }
            }

            var newUser= ref.push({
                "name": name,
                "score": 0,
                "vote": false,
                "admin": count == 0
            });

            var key = newUser.key;
            ref.child(key).get().then(function (snapshot) {
                var user = snapshot.val();
                realThis.user = new User(ref, key, user);
                if (realThis.user_changed) {
                    realThis.user_changed(user);
                }
                if (completed) {
                    completed(realThis.user);
                }
            });

        } else {
            this.user.name = name;
            this.user.update(validationElement, completed);
        }
    }

    on_user_added(x) {
        var key = x.key;
        var ref = firebase.database().ref().child("games/" + this.key + "/users");
        var user = new User(ref, key, x.val());
        this.users[key] = user;
        this.throttle_users_changed();
    }

    on_user_changed(x) {
        var key = x.key;
        var ref = firebase.database().ref().child("games/" + this.key + "/users");
        if (this.user != null && this.user.key == key) {
            var data = x.val();
            this.user.pull(data);
        } else {
            this.users[key] = new User(ref, key, x.val());
        }
        this.throttle_users_changed();
    }

    on_user_removed(x) {
        var key = x.key;
        if (this.user != null && this.user.key == key) {
            this.user = null;
            if (this.user_changed) {
                this.user_changed(u);
            }
            if (x.active && this.active == key) {
                this.active = null;
                this.fire_active_changed();
            }
        }
        delete this.users[key];
        this.throttle_users_changed();
    }

    throttle_users_changed() {
        if (this.users_changed) {
            var realThis = this;
            window.clearTimeout(this.update_timeout);
            window.setTimeout(function () {
                realThis.users_changed(realThis.users);
            }, 100);
        }
    }

    deactivate_user(completed) {
        if (this.active && this.user && this.active == this.user.key) {
            firebase.database().ref().child("games/" + this.key + "/active").set({ user: '' });
            if (completed) {
                completed("");
            }
        }
    }

    tally_scores() {
        // make sure we have the very latest info!
        if (this.user) {
            var correct = this.user.vote;
            var ref = firebase.database().ref().child("games/" + this.key + "/users");
            ref.get().then(function (snapshot) {
                var users = snapshot.val();
                for (var u in users) {
                    var user = users[u];
                    if (user.vote == correct) {
                        user.score += 1;
                    }
                }
                ref.set(users);
            });
        }
    }

    activate_user(completed) {
        var user = this.user;
        if (user == null) {
            return;
        }
        if (this.user && this.active == this.active == user.key) {
            if (completed) {
                completed();
            }
        } else {
            var realThis = this;
            var ref = firebase.database().ref().child("games/" + this.key + "/active");
            ref.transaction(function (currentData) {
                if (currentData == null || (currentData.user == "" || currentData.user == user.key)) {
                    return { user: user.key };
                } else {
                    console.log('Another user beat you to it!.');
                    return; // Abort the transaction.
                }
            }, function (error, committed, snapshot) {
                if (error) {
                    console.log('Transaction failed abnormally!', error);
                } else if (!committed) {
                    console.log('We aborted the transaction (because active is already set).');
                    var user = snapshot.val();
                    if (user && user.user in realThis.users) {
                        var u = realThis.users[user.user]
                        error = u.name + " is currently in the hot seat!";
                    }
                } else {
                    console.log('User activated!');
                    var user = snapshot.val();
                    if (user != null) {
                        // find who the new activated user is!
                        realThis.active = user.user;
                    }
                }

                if (completed) {
                    completed(error);
                }
            });
        }
    }

    on_active_added(snapshot) {
        var active = snapshot.val();
        this.active = active;
        this.fire_active_changed();
    }

    on_active_changed(snapshot) {
        var active = snapshot.val();
        this.active = active;
        this.fire_active_changed();
    }

    on_active_removed(user) {
        this.active = null;
        this.fire_active_changed();
    }

    fire_active_changed() {
        if (this.active_changed) {
            this.active_changed();
        }
    }

    delete() {
        firebase.database().ref().child("games/" + this.key).remove();
    }
}

class GameList {

    add(nameElement, validationElement, completed) {
        validationElement.text("");
        var title = nameElement.val().trim()
        if (title == "" || title.length < 10) {
            validationElement.text("Please enter a valid title (> 10 chars)");
            if (completed) {
                completed(null);
            }
            return;
        }
        var ref = firebase.database().ref().child("games");
        // make sure game does not already exist
        try {
            var realThis = this;
            var ref = firebase.database().ref().child("games");
            var gameRef = ref.orderByChild('title').equalTo(title);
            gameRef.get().then(function (snapshot) {
                var game = snapshot.val();
                if (game != null) {
                    validationElement.text("Game already exists.");
                    if (completed) {
                        completed(null);
                    }
                }
                else {
                    realThis.pushGame(title, completed);
                }
            });
        } catch (e) {
            // good, game does not already exist!
            this.pushGame(title, completed);
        }
    }

    pushGame(title, completed) {
        var ref = firebase.database().ref().child("games");
        var newGame = ref.push({
            "title": title
        });
        ref.child(newGame.key).get().then(function (snapshot) {
            var game = snapshot.val();
            if (completed) {
                completed(new Game(newGame.key, game));
            }
        });
    }

    join(nameElement, validationElement, completed) {
        validationElement.text("");
        var title = nameElement.val().trim()
        if (title == "" || title.length < 10) {
            validationElement.text("Please enter a valid title (> 10 chars)");
            return;
        }
        try {
            var ref = firebase.database().ref().child("games");
            var gameRef = ref.orderByChild('title').equalTo(title);
            gameRef.get().then(function (snapshot) {
                var game = snapshot.val();
                if (game == null) {
                    validationElement.text("Game not found.");
                    if (completed) {
                        completed(null);
                    }
                } else {
                    if (completed) {
                        for (var key in game) {
                            completed(new Game(key, game[key]));
                        }
                    }
                }
            });
        } catch (e) {
            if (e.message == "ref is not defined") {
                validationElement.text("Game not found.");
            } else {
                validationElement.text(e.message);
            }
            if (completed) {
                completed(null);
            }
        }
    }

}