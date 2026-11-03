<h1 align="center" style="border-bottom: none">
    <a href="https://github.com/toufiq-austcse/video-touch" target="_blank">
        <img alt="Video Touch" src="./images/logo.png" width="200">
    </a>

</h1>
> Video Touch is a Video Hosting & Streaming platform. In Video Touch users can easily upload, manage and stream videos on demand.

<img src ="images/dashboard.png"/>

## Table Of Contents
- [The Goals of This Project](#goal)
- [Features](#features)
- [Technologies](#technologies---libraries)
- [Backend Architecture](#the-domain-and-bounded-context---service-boundary)
- [How to Run](#how-to-run)
- [Documentation Apis](#documentation-apis)
- [Frontend](#frontend)

<a id="goal"></a>
### The Goals Of This Project
---
*  Implementing video processing with the help of asynchornus job queue
*  Generating video thumbnail
*  Using RabbitMQ as a Job Queue
*  Using Event Driven Communications
*  Using GraphQL for client side communications
*  Using AWS s3 as storage
*  Stream videos with CDN (AWS Cloudfront)
*  Building a simple Dashboard with React and Ant Design
*  Using Github Actions for implementing CI
*  Using Docker-Compose for our deployment mechanism.

<a id="features"></a>
### Features
---
* User Login/Registration
* Video Upload
* Video Transcoding in several resolutions(720p,540p,480p,360p)
* Automatic Thumbnail Generation
* Stream videos on Demand with CDN

<a id="technologies"></a>
### Technologies
---
* [NestJS](https://nestjs.com/) - A progressive Node.js framework
* [MongoDB](https://www.mongodb.com/) - As Database
* [RabbitMQ](https://www.rabbitmq.com/) - As Job Queue and Event Driven Communications
* [GraphQL](https://graphql.org/) - For writing Client Side API's
* [AWS S3](https://aws.amazon.com/s3/) - As Video Storage
* [AWS CloudFront](https://aws.amazon.com/cloudfront/) - As CDN
* [Vite](https://vite.dev/) + [React](https://react.dev/) - For developing dashboard
* [Ant Design](https://ant.design/) - UI components
* [Docker](https://www.docker.com/) - For deployment
* [Github Actions](https://github.com/features/actions) - For CI

<a id="backend-architectire"></a>
### Backend Architecture
---

<img src ="images/video_touch_architecture.png">

<a id="how-to-run"></a>
### How To Run
---
To run this project locally, follow these steps:
1. Clone this repository
```
git clone git@github.com:toufiq-austcse/video-touch.git
```
2. Run server app
*   You will need AWS credentials, S3 Bucket and Cloudfront distribution
*   From project directory run the following commands:
    ```
    cd server
    cp example.env .env
    ```
*   Put your aws credentials, s3 bucket name and cloudfront cdn url in the following env's value
    ```
    AWS_ACCESS_KEY_ID=
    AWS_REGION=
    AWS_SECRET_ACCESS_KEY=
    AWS_S3_BUCKET_NAME=
    CDN_BASE_URL=
    ```
*  Create a seperate diretory for videos in your s3 bucket and put directory url in the following env value. Example value `https://test-bucket.s3.ap-southeast-1.amazonaws.com/videos`

     ```
     VIDEO_BASE_URL=
    ```
* Put your JWT secret key and token expiren value in seconds in the following env's value. The secret must be at least 32 characters (`openssl rand -base64 48`), or the api won't start.
     ```
    JWT_SECRET=
    JWT_EXPIRATION_TIME_IN_SEC=
     ```     
* Security settings (see the comments in `example.env`):
    ```
    CORS_ORIGINS=http://localhost:3009   # browser origins allowed to call the api
    TRUST_PROXY=                         # set when the api runs behind a proxy, so log in limits see the real IP
    NODE_ENV=production                  # turns GraphiQL off
    SWAGGER_USERNAME=                    # login for /api-doc and /queues; leave empty to turn both off
    SWAGGER_PASSWORD=
    ```
* Run the follwong command
     ```
        docker compose up -d
     ```
3. Run the Frontend app
*   From project directory run the following commands:
    ```
    cd frontend
    cp .env.example .env
    docker compose up -d
    ```
*   Open `http://localhost:3009`. For local development (`npm run dev`) and the full list of env values, see [`frontend/Readme.md`](frontend/Readme.md).
4. Reset a user's password
*   There is no "forgot password" yet. Someone with server access sets a new one; it's asked for at the prompt and not shown:
    ```
    docker compose exec video-touch-api node scripts/set-user-password.js user@example.com
    ```
    Outside Docker, run `npm run user:set-password -- user@example.com` from `server/api`.
*   The user is logged out on every device and logs in again with the new password.


<a id="frontend"></a>
### Frontend
---
<details>
<summary>Click here to show the screenshots of the project</summary>
    <p> SignUp Page </p>
    <img src ="images/signup.png">
   <p> Login Page </p>
    <img src ="images/login.png">
   <p> Dashboard </p>
    <img src ="images/dashboard.png">
    <p> Video Details Page </p>
    <img src ="images/video_details.png">
    <p> Import Video From Link </p>
    <img src ="images/import_from_link.png">
    <p> Upload Video</p>
    <img src ="images/upload_video.png">
    <p> Edit Video Details </p>
    <img src ="images/edit_video_details.png">


</details>