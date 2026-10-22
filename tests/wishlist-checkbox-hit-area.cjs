// Shared offline regression: only the checkbox is a pointer toggle target.
module.exports=async function checkWishlistHitArea(page,sectionSelector,storageKey,check){
 const originalViewport=page.viewportSize();
 const checkbox=page.getByRole('checkbox',{name:'Исключать желаемое',exact:true});
 const saved=()=>page.evaluate(key=>store[key].excludeWishlist,storageKey);
 for(const width of [1200,390]){
  await page.setViewportSize({width,height:1000});
  for(const enabled of [true,false]){
   await checkbox.setChecked(enabled);
   const section=page.locator(sectionSelector);
   await section.locator('span').click();
   check(await checkbox.isChecked()===enabled&&await saved()===enabled,'wishlist text does not toggle '+width+' '+enabled);
   await section.locator(':scope > div').last().click();
   check(await checkbox.isChecked()===enabled&&await saved()===enabled,'wishlist nickname does not toggle '+width+' '+enabled);
   const inputRect=await checkbox.boundingBox();
   await page.mouse.click(inputRect.x+inputRect.width+2,inputRect.y+inputRect.height/2);
   check(await checkbox.isChecked()===enabled&&await saved()===enabled,'wishlist gap does not toggle '+width+' '+enabled);
   const row=section.locator(':scope > div').first(),rect=await row.boundingBox();
   await page.mouse.click(rect.x+rect.width-2,rect.y+rect.height/2);
   check(await checkbox.isChecked()===enabled&&await saved()===enabled,'wishlist row edge does not toggle '+width+' '+enabled);
   await checkbox.click();
   check(await checkbox.isChecked()===!enabled&&await saved()===!enabled,'checkbox click toggles and saves '+width+' '+enabled);
  }
 }
 await checkbox.focus();await checkbox.press('Space');
 check(!await checkbox.isChecked()&&await saved()===false,'focused checkbox supports Space and saves');
 await checkbox.check();
 await page.setViewportSize(originalViewport);
};
