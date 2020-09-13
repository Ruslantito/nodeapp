'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = process.env.PORT || 9999;
const statusOk = 200;
const statusNoContent = 204;
const statusBadRequest = 400;
const statusNotFound = 404;
const statusInternalServerError = 500;
const schema = 'social';

const client = mysqlx.getClient({
  user: 'app',
  password: 'pass',
  host: '0.0.0.0',
  port: 33060
});

function sendResponse(response, {status = statusOk, headers = {}, body = null}) {
  Object.entries(headers).forEach(function ([key, value]) {
    response.setHeader(key, value);
  });
  response.writeHead(status);
  response.end(body);
}

function sendJSON(response, body) {
  sendResponse(response, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function map(columns) {
  return row => row.reduce((res, value, i) => ({...res, [columns[i].getColumnLabel()]: value}), {});
}

const methods = new Map();
methods.set('/posts.get', async ({response, db}) => {
  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created'])
    .where('removed = FALSE')
    .orderBy('id DESC')
    .execute();

  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));
  sendJSON(response, posts);
});


methods.set('/posts.getById', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created']).where('removed = FALSE').execute();
  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.post', async ({response, searchParams, db}) => {
  if (!searchParams.has('content')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const content = searchParams.get('content');

  const tableF = await db.getTable('posts');
  const resultF = await tableF.insert('content')
    .values(content)
    .execute();

  const newId = resultF.getAutoIncrementValue();
  if (newId === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created']).execute();
  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));

  const post = posts.filter(o => !o.removed).find(o => o.id === newId);
  if (post === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }
  sendJSON(response, post);
});


methods.set('/posts.edit', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  if (!searchParams.has('content')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }
  const content = searchParams.get('content');

  const tableF = await db.getTable('posts');
  const resultF = await tableF.update()
    .set('content', content)
    .where('id = :id AND removed = FALSE')
    .bind('id', id)
    .execute();

  const edited = resultF.getAffectedItemsCount();

  if (edited === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created']).execute();
  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));

  const post = posts.filter(o => !o.removed).find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }
  sendJSON(response, post);
});


methods.set('/posts.delete', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const table = await db.getTable('posts');
  const result = await table.update()
    .set('removed', 1)
    .where('id = :id')
    .bind('id', id)
    .execute();

  const removed = result.getAffectedItemsCount();
  if (removed === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  const tableF = await db.getTable('posts');
  const resultF = await tableF.select(['id', 'content', 'likes', 'created']).execute();
  const dataF = resultF.fetchAll();
  const columnsF = resultF.getColumns();
  const posts = dataF.map(map(columnsF));

  const post = posts.find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }
  sendJSON(response, post);
  sendResponse(response, {status: statusNoContent});
});


methods.set('/posts.restore', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }
  
  const table = await db.getTable('posts');
  const result = await table.update()
    .set('removed', 0)
    .where('id = :id AND removed = TRUE')
    .bind('id', id)
    .execute();

  const restored = result.getAffectedItemsCount();
  if (restored === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  const tableF = await db.getTable('posts');
  const resultF = await tableF.select(['id', 'content', 'likes', 'created']).execute();
  const dataF = resultF.fetchAll();
  const columnsF = resultF.getColumns();
  const posts = dataF.map(map(columnsF));

  const post = posts.find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  post.removed = false;
  sendJSON(response, post);
});


methods.set('/posts.like', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const tableF = await db.getTable('posts');
  const resultF = await tableF.select(['id', 'content', 'likes', 'created']).execute();
  const dataF = resultF.fetchAll();
  const columnsF = resultF.getColumns();
  const posts = dataF.map(map(columnsF));

  const post = posts.find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }
  post.likes += 1; 

  const table = await db.getTable('posts');
  const result = await table.update()
    .set('likes', post.likes)
    .where('id = :id AND removed = FALSE')
    .bind('id', id)
    .execute();

  const liked = result.getAffectedItemsCount();
  if (liked === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.dislike', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const tableF = await db.getTable('posts');
  const resultF = await tableF.select(['id', 'content', 'likes', 'created']).execute();
  const dataF = resultF.fetchAll();
  const columnsF = resultF.getColumns();
  const posts = dataF.map(map(columnsF));

  const post = posts.find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }
  post.likes -= 1; 

  const table = await db.getTable('posts');
  const result = await table.update()
    .set('likes', post.likes)
    .where('id = :id AND removed = FALSE')
    .bind('id', id)
    .execute();

  const liked = result.getAffectedItemsCount();
  if (liked === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  sendJSON(response, post);
});


const server = http.createServer(async (request, response) => {
  const {pathname, searchParams} = new URL(request.url, `http://${request.headers.host}`);
  const method = methods.get(pathname);
  if (method === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  let session = null;
  try {
    session = await client.getSession();
    const db = await session.getSchema(schema);

    const params = {
      request,
      response,
      pathname,
      searchParams,
      db,
    };


    //console.log('111: ' + params.pathname);
    //console.log('222: ' + params.searchParams);


    await method(params);

  } catch (e) {
    sendResponse(response, {status: statusInternalServerError});
  } finally {
    if (session !== null) {
      try {
        await session.close();
      } catch (e) {
        console.log(e);
      }
    }
  }
  
});

server.listen(port);
