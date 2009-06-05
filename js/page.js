/**
 * Multiselect demo page initialisation script
 *
 * @author Yanick Rochon
 */
$(function() {

	$('#tabs, #optionTabs').tabs();

	$('.externalControls').hide();
	$('.externalControlsToggle').click(function() {
		$($(this).attr('href')).toggle();
		return false;
	});

	$('#submitResult').dialog({
		autoOpen: false,
		closeOnEscape: true,
		draggable: true,
		resizable: false,
		width: $('#submitFrame').width(),
		height: $('#submitFrame').height() + 65,
		title: "Form submit result"				
	});
	$('#debug').dialog({
		autoOpen: false,   // true for displaying debug information (if any)
		closeOnEscape: true,
		draggable: true,
		resizable: true,
		title: 'Debug',
		position: ['left','top']
	});

	$('form').submit(function() {
		if (!$('#submitResult').dialog('isOpen')) $('#submitResult').dialog('open');
	});


	// Multiselect controls
	var getVisibleMultiselect = function() {
		return $('#tabs-' + (parseInt($('#tabs').tabs('option', 'selected')) + 1)).find('select.multiselect[multiple]');
	};

	$('#ec_toggleEnabled').click(function(event) {
		var multiselect = getVisibleMultiselect();
		multiselect.multiselect('enabled', !multiselect.multiselect('enabled'));
		alert( "Element is " + (multiselect.multiselect('enabled') ? 'enabled' : 'disabled') );
	});
	$('#ec_checkValues').click(function() {
		var multiselect = getVisibleMultiselect();
		var values = multiselect.multiselect('selectedValues');
		if (0 === values.length) {
			alert("There is currently no selected value");
		} else if (1 === values.length) {
			alert("There is currently only 1 selected value : " + values[0]);
		} else {
			alert( "There are currently " + values.length + " selected values:\n\n" + values.join(', '));
		}
	});
	$('#ec_buttonSelectAll').click(function() {
		getVisibleMultiselect().multiselect('selectAll');
	});
	$('#ec_buttonSelectNone').click(function() {
		getVisibleMultiselect().multiselect('selectNone');
	});
	$('#ec_buttonSearch').click(function() {
		getVisibleMultiselect().multiselect('search', $('#ec_inputSearch').val() );
	});
	$('#ec_buttonItemAdd').click(function() {
		getVisibleMultiselect().multiselect('select', $('#ec_inputItem').val() );
	});
	$('#ec_buttonItemRemove').click(function() {
		getVisibleMultiselect().multiselect('deselect', $('#ec_inputItem').val() );
	});


});
