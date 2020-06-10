const express = require ('express')
const app = express()
const port = 4004
const cds = require('@sap/cds')



initcds(app);
initdrmapi(app);
app.get('/', (req, res) => res.send('Hello World!'))


app.listen(port , () => console.log(`Example app listening at http://localhost:${port}`))

async function initcds (app) {
   // await cds.connect.to ('db');
    const options = {
    "in_memory": false,
    "service": 'all',
    "from": './srv',
    "app": app
  }
    const model = cds.model = await cds.load (options.from)
   // bootstrap --in-memory db if requested
    if (options.in_memory) cds.db = await cds.deploy (model,options)

    // connect to primary database if required
    else if (cds.requires.db) cds.db = await cds.connect.to('db')


    await cds.serve(options).from(model).in(app);
}

async function initdrmapi(app) {
  app.get('/drm/legalEntities/:dataSubjectRole', (req, res) => {
    console.log("Data Subject Role: "+req.params.dataSubjectRole)  
    const legalEnties = {
        "value" : "1010",
        'valueDesc' : "Europe Company"
    }
    res.send(JSON.stringify([legalEnties]))
  })

  app.get('/drm/conditionalFieldValues/:conditionFieldName', (req, res) => {
    console.log("Data Subject Role: "+req.params.dataSubjectRole)  
    const legalEnties = {
        "value" : "1010",
        'valueDesc' : "Europe Company"
    }
    res.send(JSON.stringify([legalEnties]))
  })
}


    