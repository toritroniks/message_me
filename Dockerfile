FROM ruby:2.5.1

WORKDIR /app

ENV BUNDLER_VERSION=1.17.3
ENV NODE_VERSION=16.13.1
ENV NODE_PACKAGE=node-v${NODE_VERSION}-linux-x64
ENV NODE_HOME=/opt/${NODE_PACKAGE}
ENV NODE_PATH=${NODE_HOME}/lib/node_modules
ENV PATH=${NODE_HOME}/bin:${PATH}

RUN curl https://nodejs.org/dist/v${NODE_VERSION}/${NODE_PACKAGE}.tar.gz | tar -xzC /opt/ \
    && gem install bundler:${BUNDLER_VERSION}

COPY Gemfile Gemfile.lock ./

RUN bundle install

COPY . .

RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT [ "./entrypoint.sh" ]

CMD ["rails", "s", "-b", "0.0.0.0"]
