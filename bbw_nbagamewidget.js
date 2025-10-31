/* NBA Game Widget for BaselineBums forum
 * Copyright (c) 2025. All rights reserved.
 * 
 * This code is proprietary and may not be copied, distributed, or modified
 * without explicit written permission from the copyright holder.
 * This code is made publicly visible for transparency purposes only.
 * 
 * No permission is granted to use, copy, modify, merge, publish, distribute, 
 * sublicense, and/or sell copies of this software without explicit written 
 * permission from the copyright holder.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
*/

/* NBA Game Widget Class 
Globally Manages the NBA Game Widget
*/
class NBAGameWidget {
    constructor(pstrWidgetDiv, pstrStorageNamespace, pstrAPISource, pstrAPIParameter, pstrPrimaryTeam,pstrGradesThread,pstrGradesLink, pblnDebugMode = false) {
        //*** Set Debug Mode */
        this.blnDebugMode = pblnDebugMode

        //*** Set Widget Data */
        this.strErrorCode = "";
        this.blnDataFetched = false;
        this.dtmLastFetchDate = null;
        this.blnDataFound = false;
        this.blnDataLoaded = false;
        this.strWidgetDiv = pstrWidgetDiv;
        this.strPrimaryTeam = pstrPrimaryTeam;
        this.strActiveTab = "summary";
        this.strBoxScorePrimaryOrSecondary = "primary";
        this.strBoxScoreFullOrCompact = "compact";
        this.strBoxScoreFullOrCompactOverride = "";
        this.arrBroadcasts = [];

        //*** Game grades link */
        this.strGradesThread = pstrGradesThread
        this.strGradesLink = pstrGradesLink;

        //*** Widget Settings */
        this.strWindowSize = "";
        this.divWidgetElement = null;
        this.divFullScreenIconElement = null;
        this.divCompactScreenIconElement = null;

		//*** Setup Interactive Elements (these are tags that require event handling)
        this.divContainer = null;
		this.tabSummary = null;
		this.tabBoxScore = null;
        this.tabTeamStats = null;
        this.tabInjury = null;
        this.tabBroadcast = null;
		this.selectBoxScoreTeam = null;
		this.selectBoxScoreStyle = null;

        //*** Set Game Info Data */
        this.strAPISource = pstrAPISource;
        this.strAPIParameter = pstrAPIParameter

        //*** Initialize Game Header Data */
        this.dtmGameDate = null;
        this.strGameStatus = "";
        this.strGameStatusDetail = "";
        this.blnLiveGame = false;
        this.blnHasStarted = false;

        //*** Initialize Venue Data */
        this.strCityName = "";
        this.strVenueName = "";
        this.strAttendance = "";

        //*** Initialize Team Class */
        this.objHomeTeam = new TeamStats();
        this.objAwayTeam = new TeamStats();

        //*** Initialize Helper Classes
        this.objAPIManager = new APIManager();
        this.objAPIManager.procSetDebugMode(pblnDebugMode);
        this.objDataManager = new StorageManager(pstrStorageNamespace);
        this.objDataManager.procSetDebugMode(pblnDebugMode);

		//*** Initialize settings values
		this.objPreferences = this.funcLoadPreferences();
    }

    //*** Load User Preferences */
    funcLoadPreferences() {
		//*** Set the Defaults 
		const defaults = this.funcDefaultSettings()

		//*** Try to Load from Cached Memory
		try {
			const objStoredPrefs = this.objDataManager.funcGetJSONFromStorage("local", "user_preferences")
			if (objStoredPrefs) {
				// Merge but filter out null/undefined values from stored
				const merged = { ...defaults };
				for (const key in objStoredPrefs) {
					if (objStoredPrefs[key] != null) {  // != null checks for both null and undefined
						merged[key] = objStoredPrefs[key];
					}
				}
				return merged;
			}
		} catch (error) {
			console.error("NBAGameWidget - Error loading preferences:", error);
		}

		//*** Default Defaults if nothing was loaded
		return defaults;
	}

	//*** Save preferences to localStorage
	procSavePreferences() {
		try {
			//*** Try to save user preferences to local storage
			this.objDataManager.procSaveJSONToStorage("local", "user_preferences", this.objPreferences);
		} catch (error) {
			console.error("NBAWidget - Error saving preferences:", error);
		}
	}

	//*** Get Default Settings
	funcDefaultSettings() {
		return {
			windowSize: "full"
		};
	}

    //*** Check if Widget is allowed to run */
    funcAllowWidgetRun() {
        //*** Only allow running within baselinebums if the data-logged-in element is true for logged in users */
        const blnIsLoggedIn = document.documentElement.getAttribute('data-logged-in');
        return blnIsLoggedIn === 'true';
    }

    //*** Load Game Data */
    async procLoadGameData() {
        //*** Reset Data Loaded Flags */
        this.blnLoadAttempted = true;
        this.blnDataFound = false;
        this.blnDataLoaded = false;
        this.blnDataFetched = false;
        this.dtmLastFetchDate = null;

        //*** Load Game Data */
        if(this.funcAllowWidgetRun()) {
            let jsonGameData = null;
            switch (this.strAPISource.toLowerCase()) {
                case "espn":
                    /*** Parse Game ID from parameter */
                    const strESPNGameID = await this.funcGetGameIDFromParameterESPN(this.strAPIParameter);

                    /*** Fetch Game Data */
                    if (!strESPNGameID) {
                        this.strErrorCode = "No Games Found for: " + this.strAPIParameter;
                    } else {
                        jsonGameData = await this.funcGetGameDetailESPN(strESPNGameID);
                    }

                    /*** If JSON Data is found, process  */
                    if(!jsonGameData) {
                        this.blnNoDataFound = true;
                    } else {
                        this.procParseGameDataESPN(jsonGameData)
                    }

                    /*** If Data was loaded successfully and new fetch, store in cache */
                    if(this.blnDataLoaded && this.blnDataFetched) {
                        this.procCacheGameDetailESPN(strESPNGameID, jsonGameData);
                    }

                    //*** Break out of switch
                    break;
                default:
                    console.error(`NBAGameWidget - Unknown Game ID Type for data fetch: ${this.strAPISource}`);
                    return null;
            }
        }
    }

    //*** Get GAme ID From Parameter ESPN */
    async funcGetGameIDFromParameterESPN(pstrAPIParameter) {
        //*** Set storage type,  key, and version for retrieval */
        const strStorageType = "local";
        const strStorageKey = "game-date-to-id-espn";

        //*** Check if Numeric */
        if (!isNaN(pstrAPIParameter)) {
            return pstrAPIParameter;
        }

        //*** Check if it's a date value YYYY-MM-DD format*/
        const objDateRegex = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        const objMatch = pstrAPIParameter.match(objDateRegex);
        if (!objMatch) {
            ///*** If it doesn't match a date param, return blank */
            return "";
        }

        //*** Extract Date Values */
        const strParsedDate = objMatch[1] + objMatch[2] + objMatch[3];

        //*** Check if we've stored this game ID in our local storage */
        const jsonCache = this.objDataManager.funcGetJSONFromStorage(strStorageType,strStorageKey);
        if (jsonCache) {
            //*** Cache initialized before.  Process */
            for (let i = 0; i < jsonCache.length; i++) {
                //*** Check if it's our game.  If it is, use the ID and update the accessed date */
                if (jsonCache[i].cacheDateParam === strParsedDate) {
                    return jsonCache[i].cacheEventID;
                }
            }
        }

        //*** Get Scoreboard for this date */
        const strUrl = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${strParsedDate}`;
        const jsonRawJSON = await this.objAPIManager.funcGetAPIData(strUrl, "json");

        //*** Return blank if fetch failed */
        if(!jsonRawJSON) {
            return "";
        }

        //*** Ensure API has returned an events list */
        const arrEvents = jsonRawJSON.events;
        if (!arrEvents || arrEvents.length === 0) {
            return "";
        }

        //*** Find the Spurs game in the events array
        let strEventID = "";
        for (let i = 0; i < arrEvents.length; i++) {
            if (arrEvents[i].name && arrEvents[i].name.toLowerCase().includes("spurs")) {
                strEventID = arrEvents[i].id;
                break;
            }
        }

        //*** If no Spurs game found, return empty
        if (!strEventID) {
            return "";
        }

        //*** Calculate cutoff date (10 days ago)
        const dtmCutoffDate = new Date();
        dtmCutoffDate.setDate(dtmCutoffDate.getDate() - 10);

        //*** Filter cache to remove entries older than 10 days
        let jsonUpdatedCache = [];
        if (jsonCache && Array.isArray(jsonCache)) {
            jsonUpdatedCache = jsonCache.filter(item => {
                const dtmFetchDate = new Date(item.fetchDate);
                return dtmFetchDate >= dtmCutoffDate;
            });
        }

        //*** Create and append new cache entry
        const objNewCacheEntry = {
            fetchDate: new Date().toISOString(),
            cacheDateParam: strParsedDate,
            cacheEventID: strEventID
        };
        jsonUpdatedCache.push(objNewCacheEntry);

        //*** Save updated cache to local storage
        this.objDataManager.procSaveJSONToStorage(strStorageType, strStorageKey, jsonUpdatedCache);

        //*** Return the event ID
        return strEventID;
    }

    // Get Game Detail from ESPN
    async funcGetGameDetailESPN(pstrEventId) {
        //*** Set storage type,  key, and version for retrieval */
        const strStorageType = "local";
        const strStorageKey = "game-data-espn";
        const strStorageVersion = "1"

        //*** Check storage to see if API response is cached */
        const jsonCache = this.objDataManager.funcGetJSONFromStorage(strStorageType,strStorageKey);
        if (jsonCache) {
            //*** Check if same game and version
            if(jsonCache.cacheKey === pstrEventId && jsonCache.cacheVersion === strStorageVersion) {
                /*** Same da ta, check if refetching is allowed */
                const dtmCurrentTimeStamp = new Date();
                const dtmRefetchTimeStamp = new Date(jsonCache.refetchDate);
                if(dtmCurrentTimeStamp < dtmRefetchTimeStamp) {
                    //*** No refetching allowed, return cached data */
                    this.dtmLastFetchDate = new Date(jsonCache.fetchDate);
                    return jsonCache.cacheData;
                }
            }

            //*** Remove from Storage if exists but need to refetch
            this.objDataManager.procRemoveDataFromStorage(strStorageType,strStorageKey);
        }

        //*** Build API Url
        const strUrl = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary?region=us&lang=en&contentorigin=espn&event=${pstrEventId}`;

        //*** Fetch data using API manager and store in cache
        const jsonRawJSON = await this.objAPIManager.funcGetAPIData(strUrl, "json");
        this.blnDataFetched = true;
        this.dtmLastFetchDate = new Date();

        //*** Return null if fetch failed */
        if(!jsonRawJSON) {
            return null;
        }

        //*** Return Results
        return jsonRawJSON;
    }

    //*** Process Data ESPN */
    procParseGameDataESPN(pjsonGameData) {
        //*** Get competition object
        const objCompetition = pjsonGameData.header.competitions[0];

        //*** Extract game date
        this.dtmGameDate = new Date(objCompetition.date);

        //*** Extract game status
        this.strGameStatus = objCompetition.status.type.description;
        this.strGameStatusDetail = objCompetition.status.type.detail;

        //*** Set Live Game Flag
        const arrLiveStatuses = ["in progress", "halftime", "overtime", "beginning of period", "end of period"];
        if (arrLiveStatuses.includes(this.strGameStatus.toLowerCase())) {
            this.blnLiveGame = true;
        }

        //*** Set Has Started Flag */
        this.blnHasStarted = objCompetition.boxscoreAvailable;

        //*** Get Game Info object */
        const objGameInfo = pjsonGameData.gameInfo

        //*** Extract Venue Information */
        this.strCityName = objGameInfo.venue.address.city + " " + objGameInfo.venue.address.state;
        this.strVenueName = objGameInfo.venue.fullName;
        this.strAttendance = objGameInfo.attendance;

        //*** Extract Team Stat Information
        const arrCompetitors = objCompetition.competitors;
        for (let i = 0; i < arrCompetitors.length; i++) {
            const objCompetitor = arrCompetitors[i];
            const objTeamStats = new TeamStats();

            //*** Extra Team Info */
            objTeamStats.strTeamCode = objCompetitor.team.abbreviation.toLowerCase();
            objTeamStats.strTeamName = objCompetitor.team.name;

            //*** Extract Score Information */
            objTeamStats.intScore = objCompetitor.score ? parseInt(objCompetitor.score) : 0;
            const arrLineScores = objCompetitor.linescores;
            if (arrLineScores && arrLineScores.length > 0) {
                for (let j = 0; j < arrLineScores.length; j++) {
                    objTeamStats.arrPeriodScore.push(arrLineScores[j].displayValue);
                }
            }

            //*** Determine if Team is Home or Away */
            if (objCompetitor.homeAway === "home") {
                objTeamStats.blnHomeTeam = true;
                this.objHomeTeam = objTeamStats;
            } else {
                objTeamStats.blnHomeTeam = false;
                this.objAwayTeam = objTeamStats;
            }
        }

        //*** Extract Player Stat Information */
        const arrTeamBoxScore = pjsonGameData.boxscore.players;
        if (arrTeamBoxScore && arrTeamBoxScore.length > 0) {
            for (let i = 0; i < arrTeamBoxScore.length; i++) {
                //*** Determine Team the Stats are for */
                const strTeamBoxScoreCode = arrTeamBoxScore[i].team.abbreviation.toLowerCase();

                //*** Loop through player stats */
                const arrPlayerStats = arrTeamBoxScore[i].statistics[0].athletes
                for (let j = 0; j < arrPlayerStats.length; j++) {
                    const objPlayerStats = new PlayerStats();

                    //*** Get Athlete Info */
                    objPlayerStats.strName = arrPlayerStats[j].athlete.shortName;
                    objPlayerStats.strPosition = arrPlayerStats[j].athlete.position.abbreviation;
                    objPlayerStats.strNumber = arrPlayerStats[j].athlete.jersey;
                    objPlayerStats.blnStarter = arrPlayerStats[j].starter;
                    objPlayerStats.strDNPReason = arrPlayerStats[j].reason;

                    //*** Get Box Score Info */
                    const objStats = arrPlayerStats[j].stats
                    if (objStats && objStats.length > 0) {
                        objPlayerStats.intMinutes = parseInt(objStats[0]) || 0;;
                        objPlayerStats.intPoints = parseInt(objStats[1]);
                        const arrFGStats = objStats[9].split("-");
                        objPlayerStats.intFGM = parseInt(arrFGStats[0]);
                        objPlayerStats.intFGA = parseInt(arrFGStats[1]);
                        const arr3PStats = objStats[11].split("-");
                        objPlayerStats.int3PM = parseInt(arr3PStats[0]);
                        objPlayerStats.int3PA = parseInt(arr3PStats[1]);
                        const arrFTStats = objStats[13].split("-");
                        objPlayerStats.intFTM = parseInt(arrFTStats[0]);
                        objPlayerStats.intFTA = parseInt(arrFTStats[1]);
                        objPlayerStats.intREB = parseInt(objStats[4]);
                        objPlayerStats.intOREB = parseInt(objStats[2]);
                        objPlayerStats.intDREB = parseInt(objStats[3]);
                        objPlayerStats.intAST = parseInt(objStats[5]);
                        objPlayerStats.intSTL = parseInt(objStats[6]);
                        objPlayerStats.intBLK = parseInt(objStats[7]);
                        objPlayerStats.intTO = parseInt(objStats[8]);
                        objPlayerStats.intPF = parseInt(objStats[15]);
                        objPlayerStats.intPlusMinus = parseInt(objStats[16]);
                    }

                    //*** Determine where to push this player stat into */
                    const objTargetTeam = (this.objHomeTeam.strTeamCode === strTeamBoxScoreCode) ? this.objHomeTeam : this.objAwayTeam;
                    objTargetTeam.procAddPlayerStat(objPlayerStats);
                }
            }
        }

        //*** Sort Players by Minutes Played */
        this.objHomeTeam.procSortPlayerStatsByMinutes();
        this.objAwayTeam.procSortPlayerStatsByMinutes();

        //*** Extract Injury Information
        const arrInjuryElements = pjsonGameData.injuries;
        for(let i = 0; i < arrInjuryElements.length; i++) {
            //*** Extract Injury Info */
            let arrInjuryDetails = [];
            const arrInjuries = arrInjuryElements[i].injuries;
            for(let j = 0; j < arrInjuries.length; j++) {
                //*** Extract Injury Information */
                arrInjuryDetails.push([
                    arrInjuries[j].athlete.shortName,
                    arrInjuries[j].details.type
                ]);
            }

            //*** Add Injuries to team */
            if (arrInjuryDetails.length>0) {
                const strInjuryTeam = arrInjuryElements[i].team.abbreviation.toLowerCase()
                const objTargetTeam = (this.objHomeTeam.strTeamCode === strInjuryTeam) ? this.objHomeTeam : this.objAwayTeam;
                objTargetTeam.arrInjuries = arrInjuryDetails;
            }
        }

        //*** Extra Broadcast Information */
        this.arrBroadcasts = [];
        const arrBroadcasts = objCompetition.broadcasts || [];
        for(let i=0; i<arrBroadcasts.length; i++) {
            this.arrBroadcasts.push([
                arrBroadcasts[i].media?.shortName ?? "",
                arrBroadcasts[i].type?.shortName ?? "",
                arrBroadcasts[i].market?.type ?? ""
            ]);
        }

        //*** Set Data Loaded Flag */
        this.blnDataLoaded = true;
    }

    //*** Store data in cache and manage refresh allowance */
    procCacheGameDetailESPN(pstrEventID, pjsonGameData) {
        //*** Set storage type,  key, and version for retrieval */
        const strStorageType = "local";
        const strStorageKey = "game-data-espn";
        const strStorageVersion = "1"
        const intCacheTimeDefault = 3600000; //*** 1 hour */
        const intCacheTimeLive = 60000; //*** 1 minutes */

        /*** Determine Allowed Refetch Time */
        let intCacheTime = 0;
        const dtmFetchDate = this.dtmLastFetchDate;
        const dtmOneHourBeforeGame = new Date(this.dtmGameDate.getTime() - 3600000); // 1 hour before
        const dtmOneHourAfterGameStart = new Date(this.dtmGameDate.getTime() + 3600000);  // 1 hour after
        if (this.blnLiveGame || (dtmFetchDate >= dtmOneHourBeforeGame && dtmFetchDate <= dtmOneHourAfterGameStart)) {
            intCacheTime = intCacheTimeLive;
        } else {
            intCacheTime = intCacheTimeDefault;
        }

        //*** Store successful fetch in cache */
        const dtmRefetchDate = new Date(dtmFetchDate.getTime() + intCacheTime);
        const jsonCacheData = {
            cacheKey: pstrEventID,
            cacheVersion: strStorageVersion,
            fetchDate: dtmFetchDate.toISOString(),
            refetchDate: dtmRefetchDate.toISOString(),
            cacheData: pjsonGameData
        };
        this.objDataManager.procSaveJSONToStorage(strStorageType, strStorageKey,jsonCacheData);
    }

    //*** Force Refresh Event */
	procOnForceRefresh() {
		//*** Reload data and re-render
		(async () => {
			await this.procLoadGameData();
			this.procRenderWidgetContainer();
		})();
	}

    //*** Render Widget Container */
    procRenderWidgetContainer() {
        //*** Initialize Widget Container
        const divNBAGameWidgetContainer = document.querySelector('#' + this.strWidgetDiv);
        divNBAGameWidgetContainer.innerHTML = "";

	    //*** Set Global Theme to forum theme
		let strTheme = "";
        const htmlElement = document.documentElement;
        const strForumExplicitScheme = htmlElement.getAttribute('data-color-scheme');
        if (strForumExplicitScheme) {
            strTheme = strForumExplicitScheme
        } else {
            const blnPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            strTheme = blnPrefersDark ? 'dark' : 'light';
        }

		//*** Set Color Scheme
		if (strTheme === "dark") {
			divNBAGameWidgetContainer.classList.remove("lightPaletteSpurs");
			divNBAGameWidgetContainer.classList.add("darkPaletteSpurs");
		} else {
			divNBAGameWidgetContainer.classList.add("lightPaletteSpurs");
			divNBAGameWidgetContainer.classList.remove("darkPaletteSpurs");
		}

        //*** Initialize Widget */
        const divNBAGameWidget = document.createElement("div");
        divNBAGameWidget.className = "bbw-nbagamewidget"
        this.divWidgetElement = divNBAGameWidget;

        //*** Add Header */
        divNBAGameWidget.appendChild(this.funcRenderComponentHeader());

        //*** Check if Data Loaded */
        if(!this.blnDataLoaded) {
            divNBAGameWidget.appendChild(this.funcRenderComponentNoData());
            divNBAGameWidgetContainer.appendChild(divNBAGameWidget);
        } else {
        //*** Render Widget Header & Tab
            divNBAGameWidget.appendChild(this.funcRenderComponentSummaryHeader());
            divNBAGameWidget.appendChild(this.funcRenderComponentTabGroup());

            //*** Render Active Tab */
            switch (this.strActiveTab) {
                case "summary": 
                    divNBAGameWidget.appendChild(this.funcRenderComponentSummaryTab());
                    break;
                case "boxscore":
                    divNBAGameWidget.appendChild(this.funcRenderComponentBoxScoreTab(this.strBoxScorePrimaryOrSecondary, this.strBoxScoreFullOrCompact));
                    break;    
                case "teamstats":
                    divNBAGameWidget.appendChild(this.funcRenderComponentTeamStatsTab());
                    break;
                case "injury":
                    divNBAGameWidget.appendChild(this.funcRenderComponentInjuryTab());
                    break;
                case "broadcast":
                    divNBAGameWidget.appendChild(this.funcRenderBroadcastsTab());
                    break;
            }

            //*** Append to Container */
            divNBAGameWidgetContainer.appendChild(divNBAGameWidget);
        }

        //*** Add game grades link
        divNBAGameWidget.appendChild(this.funcRenderGameGrades());

        //*** Set Default Window Size */
        this.procChangeWindowSize();
    }

    //*** Render Widget Header */  
    funcRenderComponentHeader() {
        //*** Build Widget Title */
        const divWidgetTitle = document.createElement("div");
        divWidgetTitle.className = "bbw-nbagamewidget-header-title"
        divWidgetTitle.innerText = "Game Overview";

        //*** Build Team Logo (Empty for Now) */
        const divTeamLogo = document.createElement("div");
        divTeamLogo.className = "bbw-nbagamewidget-header-logo";

        //*** Build Refresh Button */
		const divRefreshButton = document.createElement("div");
        divRefreshButton.className = "bbw-nbagamewidget-header-button";
        divRefreshButton.innerHTML = NBAGameWidget.funcRenderRefreshIcon();

        //*** Build Toggle Full Screen Button */
        const divFullScreenIcon = document.createElement("div");
        const divCompactScreenIcon = document.createElement("div");
        divFullScreenIcon.className = "bbw-nbagamewidget-header-button";
        divCompactScreenIcon.className = "bbw-nbagamewidget-header-button";
        divFullScreenIcon.innerHTML = NBAGameWidget.funcRenderFullScreenIcon();
        divCompactScreenIcon.innerHTML = NBAGameWidget.funcRenderCollapsedScreenIcon();
        this.divFullScreenIconElement = divFullScreenIcon;
        this.divCompactScreenIconElement = divCompactScreenIcon;

		//*** Add click refresh event
		divRefreshButton.addEventListener('click', () => {
			this.procOnForceRefresh();
		});

        //*** Add click the full/compact toggle button  */
		divFullScreenIcon.addEventListener('click', () => {
            //*** Set New Preference */
            this.objPreferences.windowSize = "full";

            //*** Update Toggle Icon */
            this.procChangeWindowSize();

            //*** Save Preferences */
            this.procSavePreferences();
        });

        //*** Add click the full/compact toggle button  */
		divCompactScreenIcon.addEventListener('click', () => {
            //*** Set New Preference */
            this.objPreferences.windowSize = "compact"

            //*** Update Toggle Icon */
            this.procChangeWindowSize();

            //*** Save Preferences */
            this.procSavePreferences();
        });

        //*** Build Header Button Row */
        const divHeaderButtons = document.createElement("div");
        divHeaderButtons.className = "bbw-nbagamewidget-header-buttongroup";
        divHeaderButtons.appendChild(divRefreshButton);
        divHeaderButtons.appendChild(divFullScreenIcon);
        divHeaderButtons.appendChild(divCompactScreenIcon);

		//*** Build Header Container
		const divHeaderContainer = document.createElement("div");
		divHeaderContainer.className = "bbw-nbagamewidget-header-container";
        divHeaderContainer.appendChild(divTeamLogo);
        divHeaderContainer.appendChild(divWidgetTitle);
        divHeaderContainer.appendChild(divHeaderButtons);
		return divHeaderContainer;
    }

    //*** Render Game Header */
    funcRenderComponentSummaryHeader() {
        //*** Get Game Date */
        const divGameDate = document.createElement("div");
        divGameDate.className = "bbw-nbagamewidget-header-banner-gamedate";
        const arrGameDateOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric"};
        const arrGameTimeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
        divGameDate.innerHTML = this.dtmGameDate.toLocaleDateString("en-US", arrGameDateOptions) + "<br>" + this.dtmGameDate.toLocaleTimeString("en-US", arrGameTimeOptions);

        //*** Get Game Location */
        const divLocation = document.createElement("div");
        divLocation.className = "bbw-nbagamewidget-header-banner-location";
        divLocation.innerHTML = this.strVenueName + "<br>" + this.strCityName;

        //*** Create Game Banner */
        const divBanner = document.createElement("div");
        divBanner.className = "bbw-nbagamewidget-header-banner";
        divBanner.appendChild(divGameDate);
        divBanner.appendChild(divLocation);

        //*** Determine Primary and Secondary Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();

        //*** Create Primary Team */
        const divPrimaryTeam = document.createElement("div");
        const divPrimaryTeamName = document.createElement("div");
        const imgPrimaryTeamLogo = document.createElement("img");

        divPrimaryTeamName.className = "bbw-nbagamewidget-header-score-primaryname";
        divPrimaryTeamName.innerHTML = objPrimaryTeam.strTeamName + (objPrimaryTeam.blnHomeTeam ? " &#127968;" : "");

        imgPrimaryTeamLogo.className = "bbw-nbagamewidget-header-score-logo";
        imgPrimaryTeamLogo.src = NBAGameWidget.funcGetTeamLogoURL(objPrimaryTeam.strTeamCode);

        divPrimaryTeam.className = "bbw-nbagamewidget-header-score-primary";
        divPrimaryTeam.appendChild(imgPrimaryTeamLogo);
        divPrimaryTeam.appendChild(divPrimaryTeamName);

        //*** Create Secondary Team */
        const divSecondaryTeam = document.createElement("div");
        const divSecondaryTeamName = document.createElement("div");
        const imgSecondaryTeamLogo = document.createElement("img");

        divSecondaryTeamName.className = "bbw-nbagamewidget-header-score-secondaryname";
        divSecondaryTeamName.innerHTML = (objSecondaryTeam.blnHomeTeam ? "&#127968; " : "") + objSecondaryTeam.strTeamName;

        imgSecondaryTeamLogo.className = "bbw-nbagamewidget-header-score-logo";
        imgSecondaryTeamLogo.src = NBAGameWidget.funcGetTeamLogoURL(objSecondaryTeam.strTeamCode);

        divSecondaryTeam.className = "bbw-nbagamewidget-header-score-secondary";
        divSecondaryTeam.appendChild(imgSecondaryTeamLogo);
        divSecondaryTeam.appendChild(divSecondaryTeamName);

        //*** Create Score  */
        const divScore = document.createElement("div");
        divScore.className = "bbw-nbagamewidget-header-score-status-score";
        const intPrimaryScore = objPrimaryTeam.intScore;
        const intSecondaryScore = objSecondaryTeam.intScore;
        if (intPrimaryScore > intSecondaryScore) {
            divScore.innerHTML = `<b>${intPrimaryScore}</b> - ${intSecondaryScore}`;
        } else if (intSecondaryScore > intPrimaryScore) {
            divScore.innerHTML = `${intPrimaryScore} - <b>${intSecondaryScore}</b>`;
        } else {
            divScore.innerHTML = `${intPrimaryScore} - ${intSecondaryScore}`;
        }

        //*** Create Status */
        const divStatus = document.createElement("div");
        divStatus.className = "bbw-nbagamewidget-header-score-status-status";
        divStatus.innerHTML = this.funcGetStatusToDisplay();

        //*** Create Score/Status Element */
        const divScoreStatus = document.createElement("div");
        divScoreStatus.className = "bbw-nbagamewidget-header-score-status";
        divScoreStatus.appendChild(divScore);
        divScoreStatus.appendChild(divStatus);

        //*** Create Score Banner */
        const divScoreBanner = document.createElement("div");
        divScoreBanner.className = "bbw-nbagamewidget-header-score";
        divScoreBanner.appendChild(divPrimaryTeam);
        divScoreBanner.appendChild(divScoreStatus);
        divScoreBanner.appendChild(divSecondaryTeam);

        //*** Build and Return Rendered Summary Header */
        const divSummaryHeader = document.createElement("div");
        divSummaryHeader.className = "bbw-nbagamewidget-header";
        divSummaryHeader.appendChild(divBanner);
        if(this.blnLiveGame) {
            const divLive = document.createElement("div");
            divLive.className = "bbw-nbagamewidget-header-live";
            divLive.innerText = "LIVE";
            divSummaryHeader.appendChild(divLive);
        } 
        divSummaryHeader.appendChild(divScoreBanner);
        return divSummaryHeader;
    }

    //*** Render Tabs */
    funcRenderComponentTabGroup() {
		const divTabGroup = document.createElement("div");
		divTabGroup.className = 'bbw-nbagamewidget-tabgroup';

        //*** Build Out Tab Objects */
        this.tabSummary = this.funcRenderAndBuildTab("summary", "Summary");
		this.tabBoxScore = this.funcRenderAndBuildTab("boxscore", "Box Score");
        this.tabTeamStats = this.funcRenderAndBuildTab("teamstats", "Team Stats");;
        this.tabInjury = this.funcRenderAndBuildTab("injury", "Injuries");;
        this.tabBroadcast = this.funcRenderAndBuildTab("broadcast", "Broadcasts");;

		//*** Build Rendered Tab Group
		divTabGroup.appendChild(this.tabSummary);
		divTabGroup.appendChild(this.tabBoxScore);
        divTabGroup.appendChild(this.tabTeamStats);
        divTabGroup.appendChild(this.tabInjury);
        divTabGroup.appendChild(this.tabBroadcast);
        return divTabGroup;	
	} 

    //*** Render a Tab with Event Handling */
    funcRenderAndBuildTab(pstrTabCode, pstrTabTitle) {
		//*** Create  Tab
		const divTab = document.createElement("div");
        divTab.className = "bbw-nbagamewidget-tab";
        divTab.id = "bbw-nbagamewidget-tab-" + pstrTabCode;
        divTab.innerText = pstrTabTitle;

        //*** Set Default Status */
        divTab.classList.toggle("active", this.strActiveTab === pstrTabCode);

        //*** Set Events
        divTab.addEventListener('click', () => {
			this.procOnTabChange(pstrTabCode);
		});

        //*** Return Built Out Tab */
        return divTab;
    }

    //*** Handle Tab Change Re-Renders */
    procOnTabChange(pstrSelectedTab) {
        //*** Set Active tab
		this.strActiveTab = pstrSelectedTab;

		//*** Re-Render Widget
		this.procRenderWidgetContainer();
    }

    //*** Render Summary Tab */
    funcRenderComponentSummaryTab() {
        //*** Determine Primary and Secondary Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();
        
        //*** Create Period Score Data */
        const arrPeriodHeader = ["Team", "Q1", "Q2", "Q3", "Q4"];
        const arrPrimaryTeamPeriods = objPrimaryTeam.funcGetPeriodTable();
        const arrSecondaryTeamPeriods = objSecondaryTeam.funcGetPeriodTable();
        const arrPeriodScores = arrPrimaryTeamPeriods.concat(arrSecondaryTeamPeriods);

        //*** Determine if OT periods existed */
        for (let i = 6; i < arrPrimaryTeamPeriods[0].length; i++) {
            arrPeriodHeader.push("OT" + (i - 5));
        }

        //*** Push Total Score */
        arrPeriodHeader.push("TOT");

        //*** Render Period Scores Table */
        const divPeriodScores = NBAGameWidget.funcRenderStickyTable("Scoreboard",arrPeriodHeader,arrPeriodScores);
        //const divPeriodScores = NBAGameWidget.funcRenderTable("Scoreboard", "40px",arrPeriodHeader, arrPeriodScores);

        //*** Create Container */
        const divPeriodScoresContainer = document.createElement("div");
        divPeriodScoresContainer.className = "bbw-nbagamewidget-gamesummary-periodscores";
        divPeriodScoresContainer.appendChild(divPeriodScores);

        //*** Create Team Leader Compare */
        let arrTeamLeaders = [];

        //*** Get Points Leaders */
        arrTeamLeaders.push([
            objPrimaryTeam.strPointLeader + " (" + objPrimaryTeam.intPointLeaderPoints + ")",
            "Points",
            objSecondaryTeam.strPointLeader + " (" + objSecondaryTeam.intPointLeaderPoints + ")"
        ]);

        //*** Get Rebounds Leaders */
        arrTeamLeaders.push([
            objPrimaryTeam.strReboundLeader + " (" + objPrimaryTeam.intReboundLeaderRebounds + ")",
            "Rebounds",
            objSecondaryTeam.strReboundLeader + " (" + objSecondaryTeam.intReboundLeaderRebounds + ")"
        ]);

        //*** Get Assist Leaders */
        arrTeamLeaders.push([
            objPrimaryTeam.strAssistLeader + " (" + objPrimaryTeam.intAssistLeaderAssists + ")",
            "Assists",
            objSecondaryTeam.strAssistLeader + " (" + objSecondaryTeam.intAssistLeaderAssists + ")",
        ]);

        //*** Build Team Leader Component */
        const divTeamLeaders = NBAGameWidget.funcRenderComparison("Team Leaders",arrTeamLeaders);

        //*** Create Container */
        const divTeamLeadersContainer = document.createElement("div");
        divTeamLeadersContainer.className = "bbw-nbagamewidget-gamesummary-teamleaders";
        divTeamLeadersContainer.appendChild(divTeamLeaders);

        //*** Create Summary Widget  */
        const divGameSummary = document.createElement("div");
        divGameSummary.className = "bbw-nbagamewidget-gamesummary";
        divGameSummary.appendChild(divPeriodScoresContainer);
        divGameSummary.appendChild(divTeamLeadersContainer);
        return divGameSummary;
    }

    //*** Render Box Score Tab */
    funcRenderComponentBoxScoreTab() {
        //*** Determine Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();

		//*** Create Team Select Option
		const selectTeam = document.createElement("select");
        selectTeam.id = "bbw-nbagamewidget-boxscore-param-select-team"
        let arrTeamOptions = [];
        arrTeamOptions.push({value: "primary", text: objPrimaryTeam.strTeamName});
        arrTeamOptions.push({value:"secondary", text: objSecondaryTeam.strTeamName});
		arrTeamOptions.forEach(option => {
			const optionElement = document.createElement("option");
			optionElement.value = option.value;
			optionElement.innerText = option.text;
			selectTeam.appendChild(optionElement);
		});
        selectTeam.value = this.strBoxScorePrimaryOrSecondary;
        this.selectBoxScoreTeam = selectTeam;
        this.selectBoxScoreTeam.addEventListener('change', () => {
            this.strBoxScorePrimaryOrSecondary = this.selectBoxScoreTeam.value;
            this.procRenderWidgetContainer();
        });

        //*** Create Box Score Style Option */
		const selectStyle = document.createElement("select");
        selectStyle.id = "bbw-nbagamewidget-boxscore-param-select-style"
		const arrStyleOptions = [
			{ value: "compact", text: "Compact" },
			{ value: "full", text: "Detailed" },
		];
		arrStyleOptions.forEach(option => {
			const optionElement = document.createElement("option");
			optionElement.value = option.value;
			optionElement.innerText = option.text;
			selectStyle.appendChild(optionElement);
		});
        selectStyle.value = this.strBoxScoreFullOrCompact;
        this.selectBoxScoreStyle = selectStyle;
        this.selectBoxScoreStyle.addEventListener('change', () => {
            this.strBoxScoreFullOrCompact = this.selectBoxScoreStyle.value;
            this.procRenderWidgetContainer();
        });

        //*** Create Options Bar */
        const divOptions = document.createElement("div")
        divOptions.className = "bbw-nbagamewidget-boxscore-options"
        divOptions.appendChild(selectTeam);
        divOptions.appendChild(selectStyle);

        //*** Determine Team to Display
        let objDisplayTeam = null;
        if (this.strBoxScorePrimaryOrSecondary.toLowerCase() === "primary") {
            objDisplayTeam = this.funcGetPrimaryTeam();
        } else {
            objDisplayTeam = this.funcGetSecondaryTeam();
        }

        //*** Create Box Score Header */
        let arrBoxScoreHeader = [];
        if(this.strBoxScoreFullOrCompact.toLowerCase() === "full") {
            arrBoxScoreHeader = [
                "",
                "Min",
                "FGs",
                "3PTs",
                "FTs",
                "OReb",
                "DReb",
                "Reb",
                "Ast",
                "Stl",
                "Blk",
                "TO",
                "PF",
                "+/-",
                "Points"
            ]
        } else {
            arrBoxScoreHeader = [
                "",
                "Min",
                "Pts",
                "Reb",
                "Ast",
                "Stl",
                "Blk"
            ]
        }

        //*** Create Elements for Box Score */
        const divBoxScoreStarters = NBAGameWidget.funcRenderStickyTable("Starters",arrBoxScoreHeader, objDisplayTeam.funcGetPlayerStats(this.strBoxScoreFullOrCompact,["starter"]));
        const divBoxScoreBench = NBAGameWidget.funcRenderStickyTable("Bench", arrBoxScoreHeader, objDisplayTeam.funcGetPlayerStats(this.strBoxScoreFullOrCompact,["bench", "dnp"]));
        //const divBoxScoreStarters = NBAGameWidget.funcRenderTable("Starters", "50px",arrBoxScoreHeader, objDisplayTeam.funcGetPlayerStats(this.strBoxScoreFullOrCompact,["starter"]));
        //const divBoxScoreBench = NBAGameWidget.funcRenderTable("Bench", "50px",arrBoxScoreHeader, objDisplayTeam.funcGetPlayerStats(this.strBoxScoreFullOrCompact,["bench", "dnp"]));

        //*** Create Box Score Content */
        const divBoxScoreContent = document.createElement("div");
        divBoxScoreContent.className = "bbw-nbagamewidget-boxscore-content";
        divBoxScoreContent.appendChild(divBoxScoreStarters);
        divBoxScoreContent.appendChild(divBoxScoreBench);

        //*** Create Summary Widget */
        const divBoxScore = document.createElement("div");
        divBoxScore.className = "bbw-nbagamewidget-boxscore";
        divBoxScore.appendChild(divOptions);
        divBoxScore.appendChild(divBoxScoreContent);
        return divBoxScore;
    }

    //*** Render Head to Head Tab */
    funcRenderComponentInjuryTab() {
        //*** Determine Primary and Secondary Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();
        const intMaxInjuries = Math.max(objPrimaryTeam.arrInjuries.length, objSecondaryTeam.arrInjuries.length);

        //*** Create Injuries Table */
        let arrInjuries = [];
        for(let i=0; i < intMaxInjuries; i++) {
            //*** Get Primary Injury if it exists */
            let strPrimaryInjury = "";
            if(i < objPrimaryTeam.arrInjuries.length) {
                strPrimaryInjury = objPrimaryTeam.arrInjuries[i][0] + " (" + objPrimaryTeam.arrInjuries[i][1] + ")";
            }

            //*** Get Secondary Injury if it exists */
            let strSecondaryInjury = "";
            if(i < objSecondaryTeam.arrInjuries.length) {
                strSecondaryInjury = objSecondaryTeam.arrInjuries[i][0] + " (" + objSecondaryTeam.arrInjuries[i][1] + ")";
            }


            //*** Push Data */
            arrInjuries.push([strPrimaryInjury, " - ", strSecondaryInjury]);
        }

        //*** Create Injuries Tab */
        const divInjuries = document.createElement("div");
        divInjuries.className = "bbw-nbagamewidget-injury";
        divInjuries.appendChild(NBAGameWidget.funcRenderComparison("Injuries",arrInjuries));
        return divInjuries;
    }

    //*** Render Team Compare Tab */
    funcRenderComponentTeamStatsTab() {
        //*** Determine Primary and Secondary Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();

        //*** Build Comparison Labels */
        const arrLabels = [
            "Field Goals",
            "3 Pointers",
            "Free Throws",
            "Rebounds",
            "O-Rebounds",
            "D-Rebounds",
            "Assists",
            "Steals",
            "Blocks",
            "Turn Overs",
            "Fouls"
        ]

        //*** Create Compare Array */
        const arrPrimaryStats = objPrimaryTeam.funcGetTeamStats();
        const arrSecondaryStats = objSecondaryTeam.funcGetTeamStats();
        let arrCompare = [];
        for(let i=0; i<arrLabels.length;i++) {
            arrCompare.push([
                arrPrimaryStats[i],
                arrLabels[i],
                arrSecondaryStats[i]
            ]);
        }


        //*** Create Team Stats Tab */
        const divTeamStats = document.createElement("div");
        divTeamStats.className = "bbw-nbagamewidget-teamstats";
        divTeamStats.appendChild(NBAGameWidget.funcRenderComparison("Team Stats",arrCompare));
        return divTeamStats;
    }

    //*** Render Team Compare Tab */
    funcRenderBroadcastsTab() {
        //*** Build Table Header */
        const arrHeaders = [
            "Source",
            "Type",
            "Market"
        ]

        //*** Create Team Stats Tab */
        const divBroadcasts = document.createElement("div");
        divBroadcasts.className = "bbw-nbagamewidget-broadcast";
        divBroadcasts.appendChild(NBAGameWidget.funcRenderStickyTable("Broadcasts",arrHeaders,this.arrBroadcasts));
        return divBroadcasts;
    }

    //*** Render No Data */
    funcRenderComponentNoData() {
        //*** Create No Data Box */
        const divNoData = document.createElement("div");
		divNoData.className = "bbw-nbagamewidget-nodata";

        //*** Determine No Data Text for errors */
		if (!this.funcAllowWidgetRun()) { 
			divNoData.innerText = "Must be logged in to use widget";
		} else if (!this.blnLoadAttempted) {
			divNoData.innerText =  "In order to prevent unecessary calls\ngame data must be manually loaded\n\n";
            const divRefreshButton = document.createElement("div");
            divRefreshButton.className = "bbw-nbagamewidget-button"
            divRefreshButton.innerText ="Refresh Widget";
            divRefreshButton.style.maxWidth = "125px";
            divRefreshButton.addEventListener("click", (e) => {
                e.preventDefault();
                this.procOnForceRefresh();
            });
            divNoData.appendChild(divRefreshButton);
        } else {
            divNoData.innerText = "Error Loading Widget.  Please check parameters\n" + this.strErrorCode
        }

		//*** Return */
		return divNoData;
    }

    //*** Render Game Grades Section */
    funcRenderGameGrades() {
        //*** Create Grades Button */
        const divButton = document.createElement("div");
        divButton.className = "bbw-nbagamewidget-button"
        divButton.innerText ="Submit my Game Grades";
        divButton.style.width = "100%";
        divButton.style.fontSize = "1em";
        divButton.style.filter = "drop-shadow(2px 2px 2px var(--bbw-color-grades-shadow))";
        divButton.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/e/' + this.strGradesLink + '/viewform', '_blank');
        });

        //*** Game Grades Thread */
        const linkGradesThread = document.createElement("a");
        linkGradesThread.href = "https://baselinebums.com/threads/" + this.strGradesThread;
        linkGradesThread.target = "_blank";
        linkGradesThread.rel = "noopener noreferrer";
        linkGradesThread.style.color = "var(--bbw-palette-mutedtext)";
        linkGradesThread.style.textAlign = "right";
        linkGradesThread.style.fontSize = "0.85em";
        linkGradesThread.innerText = "View Game Grades Thread"

        //*** Create Game Grades Element */
        const divGrades = document.createElement("div");
		divGrades.className = "bbw-nbagamewidget-grades";
        divGrades.appendChild(divButton);

        //*** Create Link outside of footer */
        const divGradesContainer = document.createElement("div")
        divGradesContainer.className = "bbw-nbagamewidget-gradescontainer"
        divGradesContainer.appendChild(divGrades);
        divGradesContainer.appendChild(linkGradesThread);

        //*** Return Component */
        return divGradesContainer
    }

    //*** Change the window size */
    procChangeWindowSize() {
        if(this.objPreferences.windowSize === "full") {
            this.divWidgetElement.style.maxWidth = "100%";
            this.divFullScreenIconElement.style.display = "none ";
            this.divCompactScreenIconElement.style.display = "inline";
        } else {
            this.divWidgetElement.style.maxWidth = "700px";
            this.divFullScreenIconElement.style.display = "inline";
            this.divCompactScreenIconElement.style.display = "none ";
        }  
    }

    //*** Get Primary and Secondary Team Display Logic */
    funcGetPrimaryTeam() {
        if(this.objAwayTeam.strTeamCode.toLowerCase() === this.strPrimaryTeam.toLowerCase()) {
            return this.objAwayTeam
        } else {
            return this.objHomeTeam;
        }
        
    }
    funcGetSecondaryTeam() {
        if(this.objAwayTeam.strTeamCode.toLowerCase() === this.strPrimaryTeam.toLowerCase()) {
            return this.objHomeTeam
        } else {
            return this.objAwayTeam;
        }
    }
    //*** Get Status to Display */
    funcGetStatusToDisplay() {
        //*** Return Status status detail if game is live */
        if (this.blnHasStarted) {
            return this.strGameStatusDetail;
        } else {
            return this.strGameStatus;
        }
    }


    //*** Generically Render a Table */
    static funcRenderTable(pstrTitle, pstrColumnWidth, parrHeaderNames, parrRowData) {
        /*** Create Table */
        const divTable = document.createElement("div");
        divTable.className = "bbw-nbagamewidget-table";

        /*** Create Title */
        if (pstrTitle != "") {
            const divTableTitle = document.createElement("div");
            divTableTitle.className = "bbw-nbagamewidget-table-title";
            divTableTitle.innerHTML = pstrTitle;
            divTable.appendChild(divTableTitle);
        }

        /*** Create Header Row */
        if (parrHeaderNames && parrHeaderNames.length > 0) {
            /*** Create Header Row */
            const divTableHeader = document.createElement("div");
            divTableHeader.className = "bbw-nbagamewidget-table-header";

            /*** Create Key Column */
            const divTableHeaderKey = document.createElement("div");
            divTableHeaderKey.className = "bbw-nbagamewidget-table-header-key";
            divTableHeaderKey.innerHTML = parrHeaderNames[0];
            divTableHeader.appendChild(divTableHeaderKey);

            /*** Create Remaining Columns */
            for (let i = 1; i < parrHeaderNames.length; i++) {
                const divTableHeaderColumn = document.createElement("div");
                divTableHeaderColumn.className = "bbw-nbagamewidget-table-header-column";
                divTableHeaderColumn.innerHTML = parrHeaderNames[i];
                divTableHeaderColumn.style.maxWidth = pstrColumnWidth;
                divTableHeader.appendChild(divTableHeaderColumn);
            }

            /*** Append to Table */
            divTable.appendChild(divTableHeader);
        }

        /*** Create Column Row */
        if (parrRowData && parrRowData.length > 0) {
            for (let i = 0; i < parrRowData.length; i++) {
                /*** Create Table Row */
                const divTableRow = document.createElement("div");
                divTableRow.className = "bbw-nbagamewidget-table-row";

                //*** Create Key Column */
                const divTableRowKey = document.createElement("div");
                divTableRowKey.className = "bbw-nbagamewidget-table-row-key";
                divTableRowKey.innerHTML = parrRowData[i][0];
                divTableRow.appendChild(divTableRowKey);

                /*** Create Remaining Columns */
                for (let j = 1; j < parrRowData[i].length; j++) {
                    const divTableRowColumn = document.createElement("div");
                    divTableRowColumn.className = "bbw-nbagamewidget-table-row-column";
                    divTableRowColumn.innerHTML = parrRowData[i][j];
                    divTableRowColumn.style.maxWidth = pstrColumnWidth;
                    divTableRow.appendChild(divTableRowColumn);
                }

                /*** Append to Table */
                divTable.appendChild(divTableRow);
            }
        }

        //*** Return Rendered Table */
        return divTable;
    }

    //*** Generally Render a Sticky Table */
    static funcRenderStickyTable(pstrTitle, parrHeaderNames, parrRowData) {
        /*** Create Sticky Table */
        const divTable = document.createElement("div");
        divTable.className = "bbw-nbagamewidget-stickytable";

        /*** Create Title */
        if (pstrTitle != "") {
            const divTableTitle = document.createElement("div");
            divTableTitle.className = "bbw-nbagamewidget-stickytable-title";
            divTableTitle.innerHTML = pstrTitle;
            divTable.appendChild(divTableTitle);
        }

        /*** Create Table Viewport for Scrolling */
        const divTableViewPort = document.createElement("div");
        divTableViewPort.className = "bbw-nbagamewidget-stickytable-viewport";

        /*** Create Table Content */
        const divTableContent = document.createElement("table");
        divTableContent.className = "bbw-nbagamewidget-stickytable-content"

        /*** Create Table Header */
        if (parrHeaderNames && parrHeaderNames.length > 0) {
            /*** Create Header Container */
            const divTableHeaderContainer= document.createElement("thead");

            /*** Create Header Row */
            const divTableHeaderRow = document.createElement("tr");

            /*** Create Header Columns */
            for (let i = 0; i < parrHeaderNames.length; i++) {
                /*** Create Column */
                const divTableHeaderColumn = document.createElement("th");
                divTableHeaderColumn.innerHTML = parrHeaderNames[i];

                /*** If First Column, make sticky */
                if (i===0) {
                    divTableHeaderColumn.className = "bbw-nbagamewidget-stickytable-key";
                }

                /*** Add Column to Row */
                divTableHeaderRow.appendChild(divTableHeaderColumn);
            }

            //*** Add Header to container and viewport*/
            divTableHeaderContainer.appendChild(divTableHeaderRow);
            divTableContent.appendChild(divTableHeaderContainer);
        }

        /*** Create Table Rows */
        if (parrRowData && parrRowData.length > 0) {
            /*** Create Table Body */
            const divTableRowsContainer = document.createElement("tbody");
 
            /*** Loop Through Rows */
            for (let i = 0; i < parrRowData.length; i++) {
                /*** Create Row */
                const divTableRowsRow = document.createElement("tr");

                /*** Create Row Columns */
                for (let j = 0; j < parrRowData[i].length; j++) {
                     /*** Create Column */
                    const divTableRowColumn = document.createElement("td");
                    divTableRowColumn.innerHTML = parrRowData[i][j];

                    /*** If First Column, make sticky */
                    if (j===0) {
                        divTableRowColumn.className = "bbw-nbagamewidget-stickytable-key";
                    }

                    /*** Add Column to Row */
                    divTableRowsRow.appendChild(divTableRowColumn);
                }

                //*** Add Row to container*/
                divTableRowsContainer.appendChild(divTableRowsRow)
            }

            //*** Add Rows to the container */
            divTableContent.appendChild(divTableRowsContainer);
        }

        /*** Build Table and Return */        
        divTableViewPort.appendChild(divTableContent);
        divTable.appendChild(divTableViewPort);
        return divTable;

    }

    //*** Generally Render a Stat Comparison Table  */
    static funcRenderComparison(pstrTitle,parrRowData) {
        //*** Create Compare Component */
        const divCompare = document.createElement("div");
        divCompare.className = "bbw-nbagamewidget-compare";

        //*** Create Title */
        const divTitle = document.createElement("div");
        divTitle.className = "bbw-nbagamewidget-compare-title";
        divTitle.innerHTML = pstrTitle;
        divCompare.appendChild(divTitle);

        //*** Loop Through and Create Rows */
        for(let i=0;i<parrRowData.length;i++) {
            //*** Create Row Element */
            const divRow = document.createElement("div");
            divRow.className = "bbw-nbagamewidget-compare-row";

            //*** Create Primary Element */
            const divPrimary = document.createElement("div");
            divPrimary.className = "bbw-nbagamewidget-compare-row-primary";
            divPrimary.innerHTML = parrRowData[i][0];
            divRow.appendChild(divPrimary);

            //*** Create Label Element */
            const divLabel = document.createElement("div");
            divLabel.className = "bbw-nbagamewidget-compare-row-label";
            divLabel.innerHTML = parrRowData[i][1];
            divRow.appendChild(divLabel);

            //*** Create Secondary Element */
            const divSecondary = document.createElement("div");
            divSecondary.className = "bbw-nbagamewidget-compare-row-secondary";
            divSecondary.innerHTML = parrRowData[i][2];
            divRow.appendChild(divSecondary);

            //*** Append to Compare Component */
            divCompare.appendChild(divRow);
        }

        //*** Return Rendered Component */
        return divCompare;
    }

    //*** Get team logo URL
    static funcGetTeamLogoURL(pstrTeamAbbr) {
        //*** Use the same mapping from Game class
        const strTeamId = NBAGameWidget.mapNBAdotComTeamIDs[pstrTeamAbbr];
        if (strTeamId) {
            return `https://cdn.nba.com/logos/nba/${strTeamId}/primary/L/logo.svg`;
        }
        return "https://cdn.nba.com/logos/nba/logo.svg";
    }

	//*** Refresh Icon
	static funcRenderRefreshIcon() {
		return `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118.04 122.88"><path d="M16.08,59.26A8,8,0,0,1,0,59.26a59,59,0,0,1,97.13-45V8a8,8,0,1,1,16.08,0V33.35a8,8,0,0,1-8,8L80.82,43.62a8,8,0,1,1-1.44-15.95l8-.73A43,43,0,0,0,16.08,59.26Zm22.77,19.6a8,8,0,0,1,1.44,16l-10.08.91A42.95,42.95,0,0,0,102,63.86a8,8,0,0,1,16.08,0A59,59,0,0,1,22.3,110v4.18a8,8,0,0,1-16.08,0V89.14h0a8,8,0,0,1,7.29-8l25.31-2.3Z"/></svg>`
	}

    //*** Full Screen Icon */
    static funcRenderFullScreenIcon() {
        return `<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" 
	 viewBox="0 0 512 512">
<path d="M93.1,139.6l46.5-46.5L93.1,46.5L139.6,0H0v139.6l46.5-46.5L93.1,139.6z M93.1,372.4l-46.5,46.5L0,372.4V512h139.6
	l-46.5-46.5l46.5-46.5L93.1,372.4z M372.4,139.6H139.6v232.7h232.7V139.6z M325.8,325.8H186.2V186.2h139.6V325.8z M372.4,0
	l46.5,46.5l-46.5,46.5l46.5,46.5l46.5-46.5l46.5,46.5V0H372.4z M418.9,372.4l-46.5,46.5l46.5,46.5L372.4,512H512V372.4l-46.5,46.5
	L418.9,372.4z"/>
</svg>`;
    }

    //*** Collapsed Screen Icon */
    static funcRenderCollapsedScreenIcon() {
        return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
	<path d="M8,26a2,2,0,0,0-2,2.3A2.1,2.1,0,0,0,8.1,30h7.1L4.7,40.5a2,2,0,0,0-.2,2.8A1.8,1.8,0,0,0,6,44a2,2,0,0,0,1.4-.6L18,32.8v7.1A2.1,2.1,0,0,0,19.7,42,2,2,0,0,0,22,40V28a2,2,0,0,0-2-2Z"/>
	<path d="M43.7,4.8a2,2,0,0,0-3.1-.2L30,15.2V8.1A2.1,2.1,0,0,0,28.3,6,2,2,0,0,0,26,8V20a2,2,0,0,0,2,2H39.9A2.1,2.1,0,0,0,42,20.3,2,2,0,0,0,40,18H32.8L43.4,7.5A2.3,2.3,0,0,0,43.7,4.8Z"/>
</svg>`;
    }

    //*** NBA Team Logo Mappings
    static mapNBAdotComTeamIDs = {
        // Eastern Conference
        "atl": 1610612737, // Atlanta Hawks
        "bos": 1610612738, // Boston Celtics  
        "bkn": 1610612751, // Brooklyn Nets
        "cha": 1610612766, // Charlotte Hornets
        "chi": 1610612741, // Chicago Bulls
        "cle": 1610612739, // Cleveland Cavaliers
        "det": 1610612765, // Detroit Pistons
        "ind": 1610612754, // Indiana Pacers
        "mia": 1610612748, // Miami Heat
        "mil": 1610612749, // Milwaukee Bucks
        "ny": 1610612752,  // New York Knicks
        "nyk": 1610612752, // New York Knicks (alternate)
        "orl": 1610612753, // Orlando Magic
        "phi": 1610612755, // Philadelphia 76ers
        "tor": 1610612761, // Toronto Raptors
        "was": 1610612764, // Washington Wizards
        "wsh": 1610612764, // Washington Wizards (alternate)

        // Western Conference
        "dal": 1610612742, // Dallas Mavericks
        "den": 1610612743, // Denver Nuggets
        "gs": 1610612744,  // Golden State Warriors
        "gsw": 1610612744, // Golden State Warriors (alternate)
        "hou": 1610612745, // Houston Rockets
        "lac": 1610612746, // Los Angeles Clippers
        "lal": 1610612747, // Los Angeles Lakers
        "mem": 1610612763, // Memphis Grizzlies
        "min": 1610612750, // Minnesota Timberwolves
        "no": 1610612740,  // New Orleans Pelicans
        "nop": 1610612740, // New Orleans Pelicans (alternate)
        "okc": 1610612760, // Oklahoma City Thunder
        "phx": 1610612756, // Phoenix Suns
        "por": 1610612757, // Portland Trail Blazers
        "sac": 1610612758, // Sacramento Kings
        "sa": 1610612759,  // San Antonio Spurs
        "sas": 1610612759, // San Antonio Spurs (alternate)
        "uta": 1610612762,  // Utah Jazz
        "utah": 1610612762  // Utah Jazz (alternate)
    };
}

//*** Class to track statistics for specific team within Game */
class TeamStats {
    constructor() {
        //*** Initialize General Status */
        this.strTeamCode = "";
        this.strTeamName = "";
        this.blnHomeTeam = false;

        //*** Initialize Statistics Leaders */
        this.strPointLeader = "";
        this.intPointLeaderPoints = 0;
        this.strAssistLeader = "";
        this.intAssistLeaderAssists = 0;
        this.strReboundLeader = "";
        this.intReboundLeaderRebounds = 0;

        //*** Initialize Score Info */
        this.intScore = 0;
        this.arrPeriodScore = [];

        //*** Initialize Player Info */
        this.arrStarterStats = [];
        this.arrBenchStats = [];
        this.arrDNPStats = [];

        //*** Initialize Team Stat Info */
        this.arrTeamStats = {
            intFGM : 0,
            intFGA : 0,
            int3PM : 0,
            int3PA : 0,
            intFTM : 0,
            intFTA : 0,
            intREB : 0,
            intOREB : 0,
            intDREB : 0,
            intAST : 0,
            intSTL : 0,
            intBLK : 0,
            intTO : 0,
            intPF : 0,
        };

        //*** Initialize Injury Info */
        this.arrInjuries = []
    }

    //*** Handle Add Player Stats */
    procAddPlayerStat(pobjPlayerStat) {
        //*** Push into relevant array */
        if (pobjPlayerStat.blnStarter) {
            this.arrStarterStats.push(pobjPlayerStat);
        } else if (pobjPlayerStat.intMinutes === 0) {
            this.arrDNPStats.push(pobjPlayerStat);
        } else {
            this.arrBenchStats.push(pobjPlayerStat);
        }

        //*** Update Points Team Leaders */
        if (pobjPlayerStat.intPoints > this.intPointLeaderPoints) {
            this.strPointLeader = pobjPlayerStat.strName;
            this.intPointLeaderPoints = pobjPlayerStat.intPoints;
        }

        //*** Update Assist Team Leaders */
        if (pobjPlayerStat.intAST > this.intAssistLeaderAssists) {
            this.strAssistLeader = pobjPlayerStat.strName;
            this.intAssistLeaderAssists = pobjPlayerStat.intAST;
        }

        //*** Update Rebounds Team Leaders */
        if (pobjPlayerStat.intREB > this.intReboundLeaderRebounds) {
            this.strReboundLeader = pobjPlayerStat.strName;
            this.intReboundLeaderRebounds = pobjPlayerStat.intREB;
        }

        //*** Update Team Totals */
        const safeInt = (value) => Number.isInteger(value) ? value : 0;
        this.arrTeamStats.intFGM += safeInt(pobjPlayerStat.intFGM);
        this.arrTeamStats.intFGA += safeInt(pobjPlayerStat.intFGA);
        this.arrTeamStats.int3PM += safeInt(pobjPlayerStat.int3PM);
        this.arrTeamStats.int3PA += safeInt(pobjPlayerStat.int3PA);
        this.arrTeamStats.intFTM += safeInt(pobjPlayerStat.intFTM);
        this.arrTeamStats.intFTA += safeInt(pobjPlayerStat.intFTA);
        this.arrTeamStats.intREB += safeInt(pobjPlayerStat.intREB);
        this.arrTeamStats.intOREB += safeInt(pobjPlayerStat.intOREB);
        this.arrTeamStats.intDREB += safeInt(pobjPlayerStat.intDREB);
        this.arrTeamStats.intAST += safeInt(pobjPlayerStat.intAST);
        this.arrTeamStats.intSTL += safeInt(pobjPlayerStat.intSTL);
        this.arrTeamStats.intBLK += safeInt(pobjPlayerStat.intBLK);
        this.arrTeamStats.intTO += safeInt(pobjPlayerStat.intTO);
        this.arrTeamStats.intPF += safeInt(pobjPlayerStat.intPF);
    }

    //*** Sort Player Stats by Minutes Played */
    procSortPlayerStatsByMinutes() {
        this.arrStarterStats.sort((a, b) => b.intMinutes - a.intMinutes);
        this.arrBenchStats.sort((a, b) => b.intMinutes - a.intMinutes);
        this.arrDNPStats.sort((a, b) => b.intMinutes - a.intMinutes);
    }

    //*** Get Starter Stats Table Data */
    funcGetPlayerStats(pstrDisplayType, parrPlayerTypes) {
        //*** Determine the stats  */
        const arrCombinedPlayerStats = [];

        //*** Add Starter Stats */
        if (parrPlayerTypes.includes("starter")) {
            for (let i = 0; i < this.arrStarterStats.length; i++) {
                arrCombinedPlayerStats.push(this.arrStarterStats[i].funcGetPlayerStats(pstrDisplayType));
            }
        }

        //*** Add Bench Stats */
        if (parrPlayerTypes.includes("bench")) {
            for (let i = 0; i < this.arrBenchStats.length; i++) {
                arrCombinedPlayerStats.push(this.arrBenchStats[i].funcGetPlayerStats(pstrDisplayType));
            }
        }

        //*** Add DNP Stats */
        if (parrPlayerTypes.includes("dnp")) {
            for (let i = 0; i < this.arrDNPStats.length; i++) {
                arrCombinedPlayerStats.push(this.arrDNPStats[i].funcGetPlayerStats(pstrDisplayType));
            }
        }

        return arrCombinedPlayerStats;
    }

    //*** Get Formatted Team Stats */
    funcGetTeamStats() {
        //*** Setup % Fields */
        const intFGPerc = this.arrTeamStats.intFGA > 0 ? Math.round((this.arrTeamStats.intFGM / this.arrTeamStats.intFGA) * 100) : 0;
        const int3PPerc = this.arrTeamStats.int3PA > 0 ? Math.round((this.arrTeamStats.int3PM / this.arrTeamStats.int3PA) * 100) : 0;
        const intFTPerc = this.arrTeamStats.intFTA > 0 ? Math.round((this.arrTeamStats.intFTM / this.arrTeamStats.intFTA) * 100) : 0;

        return [
            this.arrTeamStats.intFGM + "/" + this.arrTeamStats.intFGA + " (" + intFGPerc + "%)",
            this.arrTeamStats.int3PM + "/" + this.arrTeamStats.int3PA + " (" + int3PPerc + "%)",
            this.arrTeamStats.intFTM + "/" + this.arrTeamStats.intFTA + " (" + intFTPerc + "%)",
            this.arrTeamStats.intREB,
            this.arrTeamStats.intOREB,
            this.arrTeamStats.intDREB,
            this.arrTeamStats.intAST,
            this.arrTeamStats.intSTL,
            this.arrTeamStats.intBLK,
            this.arrTeamStats.intTO,
            this.arrTeamStats.intPF
        ]
    }

    //*** Get Period Table Data */
    funcGetPeriodTable() {
        // Start with existing period scores or empty array
        const periodData = this.arrPeriodScore.length > 0 ? [...this.arrPeriodScore] : [];

        // Pad with "-" to ensure at least 4 quarters
        while (periodData.length < 4) {
            periodData.push("-");
        }

        return [[this.strTeamName, ...periodData, this.intScore]];
    }

}

class PlayerStats {
    constructor() {
        //*** Initialize Player Info */
        this.strName = "";
        this.strPosition = "";
        this.strNumber = "";
        this.blnStarter = false;
        this.strDNPReason = "";

        //*** Initialize Stats */
        this.intMinutes = 0;
        this.intPoints = 0;
        this.intFGM = 0;
        this.intFGA = 0;
        this.int3PM = 0;
        this.int3PA = 0;
        this.intFTM = 0;
        this.intFTA = 0;
        this.intREB = 0;
        this.intOREB = 0;
        this.intDREB = 0;
        this.intAST = 0;
        this.intSTL = 0;
        this.intBLK = 0;
        this.intTO = 0;
        this.intPF = 0;
        this.intPlusMinus = 0;
    }

    //*** Return Formatted Box Score */
    funcGetPlayerStats(pstrDisplayType) {
        //*** If player played 0 minutes, return name and DNP reason */
        if (parseInt(this.intMinutes) === 0) {
            return [this.strName];
        }

        //*** Return full or compact stats */
        switch (pstrDisplayType.toLowerCase()) {
            case "full":
                return [
                    this.strName,
                    this.intMinutes,
                    this.intFGM + "-" + this.intFGA,
                    this.int3PM + "-" + this.int3PA,
                    this.intFTM + "-" + this.intFTA,
                    this.intOREB,
                    this.intDREB,
                    this.intREB,
                    this.intAST,
                    this.intSTL,
                    this.intBLK,
                    this.intTO,
                    this.intPF,
                    this.intPlusMinus,
                    this.intPoints
                ]
            default: //*** Compact */
                return [
                    this.strName,
                    this.intMinutes,
                    this.intPoints,
                    this.intREB,
                    this.intAST,
                    this.intSTL,
                    this.intBLK
                ]
        }

    }

    //*** Return Formatted Box Score */
    funcGetPlayerStatsCompact() {

    }

}

/* API Manager Class
Seggregating API Calls away from Widget class for future modularity
*/
class APIManager {
    // Constructor
    constructor() {
        //*** Default Debug Mode is False
        this.blnDebugMode = false;
    }

    //*** Set Debug Method - Controls Logging
    procSetDebugMode(pblnDebugMode) {
        this.blnDebugMode = pblnDebugMode;
    }

    // Get Data from Any REST API with Caching
    async funcGetAPIData(pstrApiUrl, pstrMethod) {
        //*** Wrapper method to allow other types of fetches that then build JSON (ie: screen scrapper)
        switch (pstrMethod.toLowerCase()) {
            case "json":
                return await this.funcFetchJSONDataFromURL(pstrApiUrl);
            default:
                console.error("API Method not supported: ", pstrMethod)
                return null;
        }
    }

    // Fetch Data from Any JSON based REST API
    async funcFetchJSONDataFromURL(pstrApiUrl) {
        //*** Log URL being fetched
        if (this.blnDebugMode) { console.log("API Manager - Fetching JSON from URL: " + pstrApiUrl); }

        //*** Attempt to fetch from API
        try {
            //*** Make the HTTP request
            const objResponse = await fetch(pstrApiUrl);

            //*** Check if response was successful
            if (!objResponse.ok) {
                console.error(`API Manager- HTTP Error: ${objResponse.status} ${objResponse.statusText}`);
                return null;
            }

            //*** Parse JSON response
            const jsonData = await objResponse.json();

            //*** Log successful response
            if (this.blnDebugMode) {
                console.log("API Manager - Fetch successful. Top-level keys:", Object.keys(jsonData));
            }

            //*** Return the parsed JSON
            return jsonData;

        } catch (error) {
            //*** Log the error and return null for soft failure
            console.error("API Manager - Fetch error:", error.message);
            return null;
        }
    }

}

/* Storage Manager Class
Seggregating Storage Management away from Widget class for future modularity
*/
class StorageManager {
    // Constructor
    constructor(pstrStorageNamespace) {
        //*** Validate Namespace is Provided
        if (!pstrStorageNamespace || pstrStorageNamespace.trim() === "") {
            throw new Error("Data Manager - Storage namespace is required");
        }

        //*** Store Namespace
        this.strStorageNamespace = pstrStorageNamespace;

        //*** Default Debug Mode is False
        this.blnDebugMode = false;
    }

    //*** Set Debug Method - Controls Logging
    procSetDebugMode(pblnDebugMode) {
        this.blnDebugMode = pblnDebugMode;
    }

    //*** Build Namespaced Storage Key
    funcBuildNamespacedKey(pstrStorageKey) {
        return `${this.strStorageNamespace}::${pstrStorageKey}`;
    }

    //*** Get Generic Data From Storage
    funcGetDataFromStorage(pstrStorageType, pstrStorageKey) {
        //*** Build Namespaced Key
        const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Retrieve ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

        //*** Attempt to Retrieve Storage
        let strStorageData = "";
        switch (pstrStorageType.toLowerCase()) {
            case "local":
                strStorageData = localStorage.getItem(strNamespacedKey);
                break;
            case "session":
                strStorageData = sessionStorage.getItem(strNamespacedKey);
                break;
            default:
                console.error("Data Manager - Storage Retrieval Type not supported: ", pstrStorageType)
        }

        //*** Return Data Found
        if (strStorageData) { if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage hit for key: ${strNamespacedKey}`); } }
        return strStorageData;
    }

    //*** Save Generic Data To Storage
    procSaveDataToStorage(pstrStorageType, pstrStorageKey, pstrData) {
        //*** Build Namespaced Key
        const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Save ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

        //*** Attempt to Save to Storage
        switch (pstrStorageType.toLowerCase()) {
            case "local":
                localStorage.setItem(strNamespacedKey, pstrData);
                break;
            case "session":
                sessionStorage.setItem(strNamespacedKey, pstrData);
                break;
            default:
                console.error("Data Manager - Storage Type not supported: ", pstrStorageType)
        }

        //*** Log Storage Saved
        if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage saved for key: ${strNamespacedKey}`); }
    }

    //*** Remove Single Item From Storage
    procRemoveDataFromStorage(pstrStorageType, pstrStorageKey) {
        //*** Build Namespaced Key
        const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Remove ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

        //*** Attempt to Remove from Storage
        switch (pstrStorageType.toLowerCase()) {
            case "local":
                localStorage.removeItem(strNamespacedKey);
                break;
            case "session":
                sessionStorage.removeItem(strNamespacedKey);
                break;
            default:
                console.error("Data Manager - Storage Type not supported: ", pstrStorageType)
        }
        //*** Log successful removal
        if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage removed for key: ${strNamespacedKey}`); }
    }

    //*** Clear All Session Storage for This Namespace
    procClearSessionStorage() {
        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Clearing Session Storage for namespace: ${this.strStorageNamespace}`); }

        //*** Build Namespace Prefix
        const strNamespacePrefix = `${this.strStorageNamespace}::`;

        //*** Loop Through Session Storage and Remove Matching Keys
        let intKeysRemoved = 0;
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const strKey = sessionStorage.key(i);
            if (strKey && strKey.startsWith(strNamespacePrefix)) {
                sessionStorage.removeItem(strKey);
                intKeysRemoved++;
            }
        }

        //*** Log successful clear
        if (this.blnDebugMode) { console.log(`Data Manager - Session Storage cleared. Keys removed: ${intKeysRemoved}`); }
    }

    //*** Clear All Local Storage for This Namespace
    procClearLocalStorage() {
        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Clearing Local Storage for namespace: ${this.strStorageNamespace}`); }

        //*** Build Namespace Prefix
        const strNamespacePrefix = `${this.strStorageNamespace}::`;

        //*** Loop Through Local Storage and Remove Matching Keys
        let intKeysRemoved = 0;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const strKey = localStorage.key(i);
            if (strKey && strKey.startsWith(strNamespacePrefix)) {
                localStorage.removeItem(strKey);
                intKeysRemoved++;
            }
        }

        //*** Log successful clear
        if (this.blnDebugMode) { console.log(`Data Manager - Local Storage cleared. Keys removed: ${intKeysRemoved}`); }
    }

    // Save Dkata to Session Storage Cache
    procSaveJSONToStorage(pstrStorageType, pstrStorageKey, pjsonData) {
        try {
            //*** Convert JSON to string for storage
            const strJsonData = JSON.stringify(pjsonData);
            this.procSaveDataToStorage(pstrStorageType, pstrStorageKey, strJsonData);

            //*** Log cache save
            if (this.blnDebugMode) { console.log(`Data Manager - JSON Cached with key: ${pstrStorageKey}`); }

        } catch (error) {
            //*** Log cache save error but don't fail the operation
            console.error("Data Manager - Storage save error:", error.message);
        }
    }

    // Get Data from Session Storage Cache
    funcGetJSONFromStorage(pstrStorageType, pstrStorageKey) {
        try {
            //*** Retrieve JSON Data
            const strStoredData = this.funcGetDataFromStorage(pstrStorageType, pstrStorageKey);

            //*** Return null if no cached data found
            if (!strStoredData) { return null; }

            //*** Parse the JSON string back to object
            const jsonStoredData = JSON.parse(strStoredData);

            //*** Log cache hit
            if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage hit for key: ${pstrStorageKey}`); }

            //*** Return the parsed data
            return jsonStoredData;

        } catch (error) {
            //*** Log cache retrieval error and return null
            console.error(`Data Manager - Error retrieving ${pstrStorageType} Storage hit for key: ${pstrStorageKey}: `, error.message);
            return null;
        }
    }
}

/* Run Widget 
Main Hook to Replace Placeholder DIV tag
*/
(function () {
    //*** Wrap Initialize function 
    'use strict';
    function initNBAGameWidget() {
        //*** Get container and read data attributes
        const divWidgetContainer = document.getElementById("bbw-nbagamewidget-container");

        //*** Check if container exists
        if (!divWidgetContainer) {
            return;
        }

        //***Extract Parameters
        const strAPISource = divWidgetContainer.dataset.apiSource || "";
        const strAPIParameter = divWidgetContainer.dataset.apiParameter || "";
        const strStorageNamespace = divWidgetContainer.dataset.storageNamespace || "bbw-nbawidget";
        const blnDebugMode = divWidgetContainer.dataset.debugMode === "true" || false;
        const strPrimaryTeam = divWidgetContainer.dataset.primaryTeam || "";
        const strGradesThread = divWidgetContainer.dataset.gradesThread || "";
        const strGradesLink = divWidgetContainer.dataset.gradesLink || "";

        //*** Initialize widget with parameters from HTML
        const objNBAGameWidget = new NBAGameWidget("bbw-nbagamewidget-container", strStorageNamespace, strAPISource, strAPIParameter, strPrimaryTeam, strGradesThread, strGradesLink, blnDebugMode);
        (async () => {
            //await objNBAGameWidget.procLoadGameData();
            objNBAGameWidget.procRenderWidgetContainer();
        })();
    }

    //*** Only run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNBAGameWidget);
    } else {
        initNBAGameWidget();
    }
})();