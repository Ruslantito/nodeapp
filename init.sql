ALTER USER 'root'@'localhost' IDENTIFIED BY 'pass';

CREATE USER 'app'@'localhost' IDENTIFIED BY 'pass';
CREATE DATABASE social CHARACTER SET utf8 COLLATE utf8_general_ci;
GRANT ALL PRIVILEGES ON social.* to 'app'@'localhost';

FLUSH PRIVILEGES ;

CREATE TABLE social.posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content TEXT NOT NULL,
    likes INT NOT NULL DEFAULT 0,
    removed BOOL NOT NULL DEFAULT FALSE,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );
