# Development Setup

- ruby: 2.5.1
- bundler: 1.17.3
- nodejs: 16.13.1

## MySQL default info

- version: 5.7
- host: 127.0.0.1
- port: 3307
- database: message_me
- user: dev
- password: password

※ MySQL settings can be changed at `config/database.yml`

## Rails setup

```bash
# install gems
bundle install
# create the db structure
bundle exec rails db:migrate
# insert initial data
bundle exec rails db:seed
```

## Run local server

```bash
bundle exec rails s
```

※ You can see the app at http://localhost:3000
