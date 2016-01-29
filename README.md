## jQuery UI Multiselect

This repository is no longer actively maintained by the author. However, pull requests are always welcome. If there's someone interested in officially maintaining the plugin, please let me know.

In case you are looking for an AJAX version, please also consider "Yanick Rochon's":http://github.com/michael/multiselect/tree/next version, or also check the official "version 2.0":https://github.com/yanickrochon/jquery.uix.multiselect currently in development.

To get the order of the selected items as selected, you can do like
```javascript
var form = $("form#my_form");
$(form).on('submit', function(){
	$("ul.selected li").each(function(){
		var selected_value = $(this).attr('data-selected-value');
		if(selected_value){
			$(form).append("<input type='hidden' value='" + selected_value + "' name='selected_items_values_in_order[]' />");
		}
	});
});
```
