const cds = require('@sap/cds')
//const { Books } = cds.entities

/** Service implementation for CatalogService */
module.exports = cds.service.impl(function() {
  this.after ('READ', 'Books', each => each.stock > 111 && _addDiscount2(each,11))
  this.before ('CREATE', 'Orders', _reduceStock)
  this.before ('CREATE', 'Orders', _updateItemsNetAmout)
})

/** Add some discount for overstocked books */
function _addDiscount2 (each,discount) {
  each.title += ` -- ${discount}% discount!`
}

async function _updateItemsNetAmout (req) {
  const { Items: OrderItems } = req.data
  const transaction = cds.transaction(req);
  for (let each of OrderItems) {
    const price = await transaction.run(SELECT.one.from(Books,['price']).where({ID:each.book_ID}));
    each.netAmount = price.price;
  }
  console.log(OrderItems);
} 

/** Reduce stock of ordered books if available stock suffices */
async function _reduceStock (req) {
  const { Items: OrderItems } = req.data
  const transaction = cds.transaction(req);
// Check Customer Status
  if(req.data.customer_ID === null || req.data.customer_ID === undefined)
  {
      req.error (409,
      `No Customer information`
    )
  }

  const customer = await transaction.run(SELECT.one('sap.capire.bookshop.Customers').where({ ID: req.data.customer_ID}))

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



  return transaction.run (()=> OrderItems.map (order =>
    UPDATE ('sap.capire.bookshop.Books') .set ('stock -=', order.amount)

    .where ('ID =', order.book_ID) .and ('stock >=', order.amount)
  )) .then (all => all.forEach ((affectedRows,i) => {
    if (affectedRows === 0)  req.error (409,
      `${OrderItems[i].amount} exceeds stock for book #${OrderItems[i].book_ID}`
    )
  }))
}
