
$(function() {

	// Tab 1 : local
	$('#checkLocalEnabled').click(function(event) {
		$('#countries').multiselect('enabled', event.target.checked);
		alert( "Element is " + ($('#countries').multiselect('enabled') ? 'enabled' : 'disabled') );
	});
	$('#checkLocalValues').click(function() {
		var values = $('#countries').multiselect('selectedValues');
		if (0 === values.length) {
			alert("There is currently no selected value");
		} else if (1 === values.length) {
			alert("There is currently only 1 selected value : " + values[0]);
		} else {
			alert( "There are currently " + values.length + " selected values:\n\n" + values.join(', '));
		}
	});
	$('#buttonLocalSelectAll').click(function() {
		$('#countries').multiselect('selectAll');
	});
	$('#buttonLocalSelectNone').click(function() {
		$('#countries').multiselect('selectNone');
	});
	$('#buttonLocalSearch').click(function() {
		$('#countries').multiselect('search', $('#inputLocalSearch').val() );
	});
	$('#buttonLocalItemAdd').click(function() {
		$('#countries').multiselect('select', $('#inputLocalItem').val() );
	});
	$('#buttonLocalItemRemove').click(function() {
		$('#countries').multiselect('deselect', $('#inputLocalItem').val() );
	});


});
