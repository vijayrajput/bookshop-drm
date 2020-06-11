const cds = require('@sap/cds')
//const { Books } = cds.entities

/** Service implementation for CatalogService */
module.exports = cds.service.impl(function() {
  this.after ('READ', 'Books', each => each.stock > 111 && _addDiscount2(each,11))
  this.before ('CREATE', 'Orders', _reduceStock)
})

/** Add some discount for overstocked books */
function _addDiscount2 (each,discount) {
  each.title += ` -- ${discount}% discount!`
}

/** Reduce stock of ordered books if available stock suffices */
async function _reduceStock (req) {
  const { Items: OrderItems } = req.data
// Check Customer Status
  if(req.data.customer_ID === null || req.data.customer_ID === undefined)
  {
      req.error (409,
      `No Customer information`
    )
  }
  const customer = await SELECT.one('sap.capire.bookshop.Customers').where({ ID: req.data.customer_ID})
  if(customer === null ||customer === undefined )
  {
      req.error (409,
      `Invalid Customer`
    )
  }
  if(customer.isBlocked)
  {
     req.error (409,
      `Customer is Blocked`
    ) 
  }

  req.data.status = 'ordered';


  return cds.transaction(req) .run (()=> OrderItems.map (order =>
    UPDATE ('sap.capire.bookshop.Books') .set ('stock -=', order.amount)
    .where ('ID =', order.book_ID) .and ('stock >=', order.amount)
  )) .then (all => all.forEach ((affectedRows,i) => {
    if (affectedRows === 0)  req.error (409,
      `${OrderItems[i].amount} exceeds stock for book #${OrderItems[i].book_ID}`
    )
  }))
}
