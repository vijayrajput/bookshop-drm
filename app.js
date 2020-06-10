const express = require ('express')
const app = express()
const { PORT=4004 } = process.env
const cds = require('@sap/cds')



initcds(app);
initdrmapi(app);
app.get('/', (req, res) => res.send('Welcome to Data Retention Manager Demo !!!'))


app.listen(PORT , () => console.log(`Example app listening at http://localhost:${PORT}`))

async function initcds (app) {
   // await cds.connect.to ('db');
    const options = {
    "in_memory": false,
    "service": 'all',
    "from": '*',
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
  app.get('/drm/legalEntities/:dataSubjectRole', async (req, res) => {
    console.log("Data Subject Role: "+req.params.dataSubjectRole)
    
    const legalEntities = [];
    let dbLegalEntities = [];
    try{
      console.log(cds.entities.LegalEntities);  
    dbLegalEntities = await cds.read(cds.entities.LegalEntities).where({role: req.params.dataSubjectRole})
    }
    catch(e)
    {
       console.log(e);
    }
   for (let each of dbLegalEntities) {
        const legalEnties = {
        "value" : each.ID,
        'valueDesc' : each.description
       }
       legalEntities.push(legalEnties)

    }
    
    
    res.send(JSON.stringify(legalEntities))
  })

  app.get('/drm/conditionalFieldValues/:conditionFieldName', (req, res) => {
    console.log("DConditionFieldName : "+req.params.conditionFieldName)  
    const legalEnties = {
        "value" : "1010",
        'valueDesc' : "Europe Company"
    }
    res.send(JSON.stringify([legalEnties]))
  })
}


    