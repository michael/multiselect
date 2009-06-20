<?php
/**
 * ajax.php
 *
 * Simple remote file to query a text database for known languages and
 * return matching results. This file requires data.txt as data source.
 * Any data may be provided as long as it is formatted as "key=value",
 * one entry per line.
 *
 * The results returned by this script matches the format found in data.txt,
 * ie: "key=value", one per line.
 *
 * Arguments :
 *
 *    q        the query string to search. The provided string will be
 *             tested against the "value" part of the data (case insensitive)
 *               Ex: q=en       will match any data containing *en*
 *    limit    (optional) specify a limit of results to return. If not
 *             specified, the default value is DEFAULT_LIMIT
 *               Ex: limit=20   will not return more than 20 results even
 *                              if more matches
 *
 * Note : if the q argument is empty, a randomized cherry pick array will
 *        be returned of size limit. The same random array is returned for
 *        the entire session.
 *
 * @author Yanick Rochon (yanick[dot]rochon[at]gmail[dot]com)
 * @created 2009-05-18 7:26:39 GMT -5:00
 */
session_start();

// the default limit if the parameter is not specified
define('DEFAULT_LIMIT', 50);

if ( !isset($_SESSION['data']) ) {
	$buffer = file_get_contents('data.txt');
	$data = array();
	foreach (explode("\n", $buffer) as $line) {
		list($code,$lang) = split("=", $line);
		if (!empty($code)) $data[$code] = trim($lang,"\r");
	}
	$_SESSION['data'] = $data;
} else {
	$data = $_SESSION['data'];
}


header('Content-type: text/plain; charset=utf-8');

$limit = isset($_GET['limit']) && !empty($_GET['limit']) ? $_GET['limit'] : DEFAULT_LIMIT;

if ( isset($_GET['q']) && !empty($_GET['q']) ) {

	$count = 0;
	foreach ($data as $code => $lang) {
		if ( false !== stripos($lang, $_GET['q']) ) {
			echo $code . '=' . trim($lang) . "\n";
			if ( ++$count >= $limit ) break;
		}
	}

} else {

	if ( !isset($_SESSION['default_indexes']) ) {
		$_SESSION['default_indexes'] = array_rand($data, $limit);
	}

	foreach ($_SESSION['default_indexes'] as $code) {
		echo $code . '=' . $data[$code] . "\n";
	}

}
