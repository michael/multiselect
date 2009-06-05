<?php
@session_start();

header('Content-type: text/plain; charset:utf-8');

// ignore these fields in the $_REQUEST
$ignoredKeys = array('PHPSESSID', 'jquery-ui-theme', 'reset');
$formData = array();
foreach ($_REQUEST as $key => $value) {
	if (!in_array($key, $ignoredKeys) ) {
		$formData[$key] = $value;
	}
}

if (empty($formData) || isset($_REQUEST['reset'])) {

	echo "Waiting form submission...";

} else {

	echo date('Y-m-d g:i:s', time()) . ' - '
		. "The form has submitted the following values :\n\n";

	foreach ($formData as $fieldName => $value) {
		if (is_array($value)) {
			$valueData = $value;
			$value = '';
			foreach ($valueData as $data) {
				$value .= (!empty($value) ? ', ' : '') . $data;
			}
		}

		echo "Field : " . $fieldName . "\n"
			. "Value : " . $value . "\n\n";
	}

	echo "\n"
		. "Done.";

}
