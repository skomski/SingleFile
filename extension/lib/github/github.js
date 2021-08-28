/*
 * Copyright 2010-2020 Gildas Lormeau
 * contact : gildas.lormeau <at> gmail.com
 * 
 * This file is part of SingleFile.
 *
 *   The code in this file is free software: you can redistribute it and/or 
 *   modify it under the terms of the GNU Affero General Public License 
 *   (GNU AGPL) as published by the Free Software Foundation, either version 3
 *   of the License, or (at your option) any later version.
 * 
 *   The code in this file is distributed in the hope that it will be useful, 
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of 
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero 
 *   General Public License for more details.
 *
 *   As additional permission under GNU AGPL version 3 section 7, you may 
 *   distribute UNMODIFIED VERSIONS OF THIS file without the copy of the GNU 
 *   AGPL normally required by section 4, provided you include this license 
 *   notice and a URL through which recipients can access the Corresponding 
 *   Source.
 */

/* global fetch */

export { pushGitHub };

let pendingPush;

async function pushGitHub(token, userName, repositoryName, branchName, path, content) {
	while (pendingPush) {
		await pendingPush;
	}
	pendingPush = async () => {
		try {
			const refData = await getRefData(`heads/${branchName}`);
			const commitSHA = refData.object.sha;
			let commitData = await getCommitData(commitSHA);
			const treeData = await createTree({ path, content }, commitData.tree.sha);
			commitData = await commit(commitSHA, treeData.sha);
			await updateHead(commitData.sha);
		} finally {
			pendingPush = null;
		}
	};
	await pendingPush();

	function getRefData(ref) {
		return fetchAPI(`refs/${ref}`);
	}

	function getCommitData(commitSHA) {
		return fetchAPI(`commits/${commitSHA}`);
	}

	function createTree({ path, content }, treeSHA) {
		return fetchAPI("trees", {
			tree: [{ path, content, mode: "100644" }],
			base_tree: treeSHA
		});
	}

	function commit(commitSHA, treeSHA, message = "") {
		return fetchAPI("commits", {
			message,
			parents: [commitSHA],
			tree: treeSHA
		});
	}

	function updateHead(commitSHA) {
		return fetchAPI(`refs/heads/${branchName}`, {
			sha: commitSHA
		}, "patch", [["accept", "application/vnd.github.v3+json"]]);
	}

	async function fetchAPI(path, data, method, extraHeaders = []) {
		const response = await fetch(`https://api.github.com/repos/${userName}/${repositoryName}/git/${path}`, {
			method: method ? method.toUpperCase() : data ? "POST" : "GET",
			headers: new Map([["authorization", `token ${token}`]].concat(extraHeaders)),
			body: data ? JSON.stringify(data) : null
		});
		const responseData = await response.json();
		if (response.status < 400) {
			return responseData;
		} else {
			throw new Error(responseData.message);
		}
	}
}
